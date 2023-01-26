---@diagnostic disable: undefined-global
-- sourcepos.lua
-- 
-- filter for 'plain' format that will generate a list of blocks and their line numbers
--
-- for example: pandoc --from=commonmark_x+sourcepos --to=plain --lua-filter=sourcepos.lua foo.md
-- 
-- might yield:
-- 
--  Para:8
--  BulletList:23
--  Para:23
--  Para:24
--  HorizontalRule:27
--  Para:29
--  BlockQuote:32
--  Para:32
--  Para:34
--  RawBlock:36
--  Header:39
--  Para:41
--  BulletList:51
--  CodeBlock:53
--  Para:57
--  CodeBlock:63
--  Header:66
--  Div:68
--  Para:69
--  Header:74
--  Para:76
--  
-- certain types are automatically collapsed to paragraph, including:
--
--   Table, LineBlock, Plain, DefinitionList
--
-- this collapsing is done either b/c commonmark_x doesn't support 
-- these types (e.g grid tables, line blocks, plain) or because
-- source positions are reported in an unexpected way (definition lists)
   

local positions = pandoc.List()

local supportedTypes = pandoc.List{
  "Para",
  "Header",
  "CodeBlock",
  "Div",
  "BulletList",
  "OrderedList",
  "RawBlock",
  "BlockQuote",
  "HorizontalRule"
}

local function isSupportedBlock(type)
  return supportedTypes:includes(type)
end


local function extractPosition(el, type)

  -- determine the underlying type
  if not type then
    type = el.t
  end

  -- process if this is a supported type
  if isSupportedBlock(type) then
    local pos =  el.attr.attributes["data-pos"]
    if pos then
      local _,_,line,start,finish = string.find(pos, "^.*@(%d+):(%d+)-(%d+).*$")
      positions:insert({
        type = type,
        line = tonumber(line),
        start = tonumber(start),
        finish = tonumber(finish),
        index = #positions
      })
    end
  end
  
end

return {
  {
    Table = function(el)
      return pandoc.Div({pandoc.Para({})}, el.attr)
    end,

    LineBlock = function(el)
      return pandoc.Para(el.content)
    end,

    Plain = function(el)
      return pandoc.Para(el.content)
    end,

    DefinitionList = function(el)
      return pandoc.Para{}
    end,

    Blocks = function(blocks)
      return blocks:filter(function(el) 
        return isSupportedBlock(el.t) 
      end)
    end
  },
  {
    Header = function(el)
      extractPosition(el)
    end,
    
    CodeBlock = function(el)
      extractPosition(el)
    end,
  
    Div = function(el)

      -- eliminate duplicate attributes
      local attributes = {}
      for k,v in pairs(el.attributes) do
        attributes[k] = v
      end

      if #el.identifier > 0 or #el.classes > 0 or #attributes > 1 then
        extractPosition(el)
      elseif #el.content == 1 then
        extractPosition(el, el.content[1].t)
      end

    end,
    
    Pandoc = function(doc)
      -- sort by line
      positions:sort(function (a, b) 
        if a.line == b.line then
          if a.finish == b.finish then
            return a.index < b.index
          else
            return a.finish > b.finish 
          end
        else
          return a.line < b.line 
        end
      end)
    
      -- generate content
      local content = pandoc.LineBlock(positions:map(function(pos) 
        return pandoc.Inlines({
          pandoc.Str(pos.type .. ":" .. pos.line)
        }) 
      end))
    
      -- return doc
      doc.blocks = pandoc.List({ content })
      return doc
    end
  }
}
