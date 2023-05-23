---@diagnostic disable: undefined-global
-- parser.lua

local tokens = pandoc.List()

local supportedTokens = pandoc.List{
  "BlockQuote",
  "BulletList",
  "CodeBlock",
  "Div",
  "Header",
  "HorizontalRule",
  "OrderedList",
  "Para",
  "RawBlock",
  "Table",
  "Code",
  "Image",
  "Link",
  "Math",
  "Note",
  "RawInline",
  "Span"
}

local function isSupportedToken(type)
  return supportedTokens:includes(type)
end

local function attrEmpty(attr)
  return #attr.identifier == 0 and #attr.classes == 0 and #attr.attributes == 0
end

local function extractAttrAndPos(el)
  -- clone
  local attr = el.attr:clone()

  -- eliminate duplicate attributes
  local attributes = {}
  for k,v in pairs(attr.attributes) do
    attributes[k] = v
  end

  -- record and remove pos
  local pos = attributes["data-pos"]
  attributes["data-pos"] = nil

  -- return attr and pos
  return pandoc.Attr(attr.identifier, attr.classes, attributes), pos
end

local function extractToken(el)

  -- get type, attr, and position
  local type = el.t
  local attr, pos = extractAttrAndPos(el)

  -- if there is no position then bail
  if pos == nil then
    return
  end

  -- if this is a span or div with a single child without attributes
  -- then unwrap the underlying element type
  if (type == "Span" or type == "Div") and
      #el.content == 1 and el.content[1].attr == nil then
    el = el.content[1]
    type = el.t
  end

  -- mask out types we don't care about
  if not isSupportedToken(type) then
    return
  end

  -- parse position
  local _,_,beginLine,beginChar,endLine,endChar = string.find(pos, "@?(%d+):(%d+)-(%d+):(%d+)$")
  if beginLine and beginChar and endLine and endChar then
    
    -- universal token info (type and range)
    local token = {
      type = type,
      range = {
        start = {
          line = tonumber(beginLine) - 1,
          character = tonumber(beginChar) - 1
        },
        ["end"] = {
          line = tonumber(endLine) - 1,
          character = tonumber(endChar) - 1
        }
      }
    }

    -- level if this is a header
    if type == "Header" then
      token["level"] = el.level
    end

    -- attributes if we have any
    if not attrEmpty(attr) then
      token["attr"] = attr
    end

    -- special 'data' for some types
    if type == "Header" or type == "Image" then
      token["data"] = pandoc.utils.stringify(el)
    elseif type == "CodeBlock" then
      token["data"] = el.text
    elseif type == "Link" then
      token["data"] = el.target
    elseif type == "Math" then
      token["data"] = el.mathtype
    end

    -- insert token
    tokens:insert(token)
  end
  
end

return {
  {
    -- blocks
    Div = extractToken,
    Table = extractToken,
    Heading = extractToken,
    CodeBlock = extractToken,
    Figure = extractToken,
    Header = extractToken,

    -- inlines
    Span = extractToken,
    Code = extractToken,
    Image = extractToken,
    Link = extractToken,
  },
  {
    Pandoc = function(doc)
      -- order tokens
      tokens:sort(function (a, b) 
        if a.range.start.line == b.range.start.line then
          if a.range["end"].line == b.range["end"].line then
            if a.range.start.character == b.range.start.character then
              return a.range["end"].character > b.range["end"].character
            else
              return a.range.start.character < b.range.start.character
            end
          else
            return a.range["end"].line > b.range["end"].line
          end
        else
          return a.range.start.line < b.range.start.line
        end
      end)
    
      -- return doc
      doc.blocks = pandoc.List({ pandoc.RawBlock("plain", pandoc.json.encode(tokens)) })
      return doc
    end
  }
}
