


// const resourcesDir = path.join(__dirname, "resources");

function langaugeServiceMdParser() : IMdParser {

  const mdParser : IMdParser = {
    slugifier: undefined,
    tokenize: function (document: ITextDocument): Promise<Token[]> {
      throw new Error("Function not implemented.");
    }
  };

  return mdParser;

}




