function CompilerClass(machine)
{
  this.machine = machine;

  this.LexemeUnknown          = -1;
  this.LexemeEnd              =  0;
  this.LexemeExclamationMark  =  1;
  this.LexemeLeftBraces       =  2;
  this.LexemeLeftParentheses  =  3;
  this.LexemeRightBraces      =  4;
  this.LexemeRightParentheses =  5;
  this.LexemeSemicolon        =  6;
  this.LexemeNumber           =  7;
  this.LexemeName             =  8;
  this.LexemeBreak            =  9;
  this.LexemeContinue         = 10;
  this.LexemeElse             = 11;
  this.LexemeFind             = 12;
  this.LexemeHave             = 13;
  this.LexemeIf               = 14;
  this.LexemeLeft             = 15;
  this.LexemeLoop             = 16;
  this.LexemeMove             = 17;
  this.LexemeNorth            = 18;
  this.LexemePut              = 19;
  this.LexemeRepeat           = 20;
  this.LexemeReturn           = 21;
  this.LexemeStop             = 22;
  this.LexemeTake             = 23;
  this.LexemeWall             = 24;
  this.LexemeWhile            = 25;

  this.keyWordsTable =
  [
    { value: 'break',    lexeme: this.LexemeBreak    },
    { value: 'continue', lexeme: this.LexemeContinue },
    { value: 'else',     lexeme: this.LexemeElse     },
    { value: 'find',     lexeme: this.LexemeFind     },
    { value: 'have',     lexeme: this.LexemeHave     },
    { value: 'if',       lexeme: this.LexemeIf       },
    { value: 'left',     lexeme: this.LexemeLeft     },
    { value: 'loop',     lexeme: this.LexemeLoop     },
    { value: 'move',     lexeme: this.LexemeMove     },
    { value: 'name',     lexeme: this.LexemeName     },
    { value: 'north',    lexeme: this.LexemeNorth    },
    { value: 'put',      lexeme: this.LexemePut      },
    { value: 'repeat',   lexeme: this.LexemeRepeat   },
    { value: 'return',   lexeme: this.LexemeReturn   },
    { value: 'stop',     lexeme: this.LexemeStop     },
    { value: 'take',     lexeme: this.LexemeTake     },
    { value: 'wall',     lexeme: this.LexemeWall     },
    { value: 'while',    lexeme: this.LexemeWhile    }
  ];

  this.text = undefined;
  this.textPosition = undefined;
  this.textLine = undefined;
  this.textColumn = undefined;
  this.lexeme = undefined;
  this.lexemeValue = undefined;
  this.lexemeLine = undefined;
  this.lexemeColumn = undefined;

  this.ResultExceptedLeftParentheses        = 'Excepted "("';
  this.ResultExceptedRightParentheses       = 'Excepted ")"';
  this.ResultExceptedSemicolon              = 'Excepted ";"';
  this.ResultExceptedElseOrCommand          = 'Excepted "else" or &lt;command&gt;';
  this.ResultExceptedLeftBraces             = 'Excepted "{"';
  this.ResultExceptedRightBraces            = 'Excepted "}"';
  this.ResultExceptedCommand                = 'Excepted &lt;command&gt;';
  this.ResultExceptedCondition              = 'Excepted &lt;condition&gt;';
  this.ResultExceptedFucntionName           = 'Excepted &lt;function name&gt;';
  this.ResultExceptedNumber                 = 'Excepted &lt;number&gt;';
  this.ResultExceptedPositiveNumber         = 'Number must be positive';
  this.ResultExceptedAlreadyDefinedFunction = 'Function "{}" already defined';
  this.ResultExceptedUndefinedFunction      = 'Undefined call of "{}"';
  this.ResultBreakWithoutLoop               = 'Break without while, loop, repeat';
  this.ResultContinueWithoutLoop            = 'Continue without while, loop, repeat';

  this.LoopTypeWhile  = 1;
  this.LoopTypeLoop   = 2;
  this.LoopTypeRepeat = 3;

  this.code = undefined;
  this.address = undefined;
  this.callTable = undefined;
  this.functionAddressTable = undefined;
  this.addressFunctionTable = undefined;
  this.loopInfo = undefined;

  this.addToCode = function(what)
  {
    var returnValue = this.address;
    this.code[this.address] = what;
    this.address++;
    return returnValue;
  };

  this.addTocallTable = function(name, address, line, column)
  {
    this.callTable.push({ name: name, address: address, line: line, column: column });
  };

  this.addToFunctionAddressTable = function(name, address)
  {
    if(Object.keys(this.functionAddressTable).indexOf(name) >= 0)
      return true;
    this.functionAddressTable[name] = address;
    this.addressFunctionTable[address] = name;
    return false;
  };

  this.addToLoopInfo = function(type)
  {
    this.loopInfo.push({ type: type, breakAddress: [], continueAddress: [] });
  };

  this.nextTextPosition = function()
  {
    this.textPosition++;
    if(this.text.charAt(this.textPosition) == '\n')
    {
      this.textLine++;
      this.textColumn = 0;
    }
    else
      this.textColumn++;
  };

  this.loadLexeme = function()
  {
    this.lexeme = this.LexemeUnknown;
    this.lexemeValue = undefined;
    this.lexemeLine = this.textLine;
    this.lexemeColumn = this.textColumn;
    while
    (
      this.textPosition < this.text.length &&
      this.text.charAt(this.textPosition).match(/^[# \t\n]$/)
    )
    {
      if(this.text.charAt(this.textPosition) == '#')
      {
        this.nextTextPosition();
        while
        (
          this.textPosition < this.text.length &&
          this.text.charAt(this.textPosition) != '\n'
        )
          this.nextTextPosition();
      }
      this.nextTextPosition();
    }
    if(this.textPosition >= this.text.length)
      this.lexeme = this.LexemeEnd;
    else if(this.text.charAt(this.textPosition) == '!')
    {
      this.lexeme = this.LexemeExclamationMark;
      this.lexemeValue = '!';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition) == '{')
    {
      this.lexeme = this.LexemeLeftBraces;
      this.lexemeValue = '{';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition) == '(')
    {
      this.lexeme = this.LexemeLeftParenthesesns;
      this.lexemeValue = '(';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition) == '}')
    {
      this.lexeme = this.LexemeRightBraces;
      this.lexemeValue = '}';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition) == ')')
    {
      this.lexeme = this.LexemeRightParenthesesrens;
      this.lexemeValue = ')';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition) == ';')
    {
      this.lexeme = this.LexemeSemicolon;
      this.lexemeValue = ';';
      this.nextTextPosition();
    }
    else if(this.text.charAt(this.textPosition).match(/^[0-9]$/))
    {
      this.lexeme = this.LexemeNumber;
      this.lexemeValue = this.text.charAt(this.textPosition);
      this.nextTextPosition();
      while
      (
        this.textPosition < this.text.length &&
        this.text.charAt(this.textPosition).match(/^[0-9]$/)
      )
      {
        this.lexemeValue += this.text.charAt(this.textPosition);
        this.nextTextPosition();
      }
    }
    else if(this.text.charAt(this.textPosition).match(/^[a-zA-Z_$]$/))
    {
      this.lexeme = this.LexemeName;
      this.lexemeValue = this.text.charAt(this.textPosition);
      this.nextTextPosition();
      while
      (
        this.textPosition < this.text.length &&
        this.text.charAt(this.textPosition).match(/^[a-zA-Z0-9_$]$/)
      )
      {
        this.lexemeValue += this.text.charAt(this.textPosition);
        this.nextTextPosition();
      }
      for(var i = 0; i < this.keyWordsTable.length; i++)
        if(this.keyWordsTable[i].value == this.lexemeValue)
        {
          this.lexeme = this.keyWordsTable[i].lexeme;
          break;
        }
    }
  };

  this.makeResult = function(result)
  {
    return result+' at '+this.lexemeLine+':'+this.lexemeColumn;
  };

  this.parserCondition = function()
  {
    var flag = false;
    while(this.lexeme == this.LexemeExclamationMark)
    {
      flag = !flag;
      this.loadLexeme();
    }
    switch(this.lexeme)
    {
      case this.LexemeNorth:
        if(flag)
          this.addToCode(this.machine.CodeBn);
        else
          this.addToCode(this.machine.CodeBnn);
        this.loadLexeme();
        break;
      case this.LexemeWall:
        if(flag)
          this.addToCode(this.machine.CodeBw);
        else
          this.addToCode(this.machine.CodeBnw);
        this.loadLexeme();
        break;
      case this.LexemeHave:
        if(flag)
          this.addToCode(this.machine.CodeBh);
        else
          this.addToCode(this.machine.CodeBnh);
        this.loadLexeme();
        break;
      case this.LexemeFind:
        if(flag)
          this.addToCode(this.machine.CodeBf);
        else
          this.addToCode(this.machine.CodeBnf);
        this.loadLexeme();
        break;
      default:
        return this.makeResult(this.ResultExceptedCondition);
    }
    return true;
  };

  this.parserCommand = function()
  {
    switch(this.lexeme)
    {
      case this.LexemeLeft:
        this.addToCode(this.machine.CodeLeft);
        this.loadLexeme();
        break;
      case this.LexemeMove:
        this.addToCode(this.machine.CodeMove);
        this.loadLexeme();
        break;
      case this.LexemePut:
        this.addToCode(this.machine.CodePut);
        this.loadLexeme();
        break;
      case this.LexemeTake:
        this.addToCode(this.machine.CodeTake);
        this.loadLexeme();
        break;
      case this.LexemeBreak:
        if(this.loopInfo.length == 0)
          return this.makeResult(this.ResultBreakWithoutLoop);
        if(this.loopInfo[this.loopInfo.length-1].type == this.LoopTypeRepeat)
        {
          this.addToCode(this.machine.CodePop);
          this.addToCode(1);
        }
        this.addToCode(this.machine.CodeJump);
        this.loopInfo[this.loopInfo.length-1].breakAddress.push(this.addToCode(-1));
        this.loadLexeme();
        break;
      case this.LexemeContinue:
        if(this.loopInfo.length == 0)
          return this.makeResult(this.ResultContinueWithoutLoop);
        this.addToCode(this.machine.CodeJump);
        this.loopInfo[this.loopInfo.length-1].continueAddress.push(this.addToCode(-1));
        this.loadLexeme();
        break;
      case this.LexemeReturn:
        var nestedStackSize = 0;
        for(var i = 0; i < this.loopInfo.length; i++)
          if(this.loopInfo[i].type == this.LoopTypeRepeat)
            nestedStackSize++;
        if(nestedStackSize > 0)
        {
          this.addToCode(this.machine.CodePop);
          this.addToCode(nestedStackSize);
        }
        this.addToCode(this.machine.CodeRet);
        this.loadLexeme();
        break;
      case this.LexemeStop:
        this.addToCode(this.machine.CodeStop);
        this.loadLexeme();
        break;
      case this.LexemeName:
        this.addToCode(this.machine.CodeCall);
        this.addTocallTable(this.lexemeValue, this.addToCode(-1), this.lexemeLine, this.lexemeColumn);
        this.loadLexeme();
        if(this.lexeme != this.LexemeLeftParenthesesns)
          return this.makeResult(this.ResultExceptedLeftParentheses);
        this.loadLexeme();
        if(this.lexeme != this.LexemeRightParenthesesrens)
          return this.makeResult(this.ResultExceptedRightParentheses);
        this.loadLexeme();
        break;
      case this.LexemeSemicolon:
        break;
      default:
        return this.makeResult(this.ResultExceptedCommand);
    }
    return true;
  };

  this.parserStatment = function()
  {
    var result;
    var loopAddress;
    var toOutAddress;
    var loopInfoTop;
    switch(this.lexeme)
    {
      case this.LexemeSemicolon:
      case this.LexemeName:
      case this.LexemeLeft:
      case this.LexemeMove:
      case this.LexemePut:
      case this.LexemeTake:
      case this.LexemeBreak:
      case this.LexemeContinue:
      case this.LexemeReturn:
      case this.LexemeStop:
        result = this.parserCommand();
        if(result !== true)
          return result;
        if(this.lexeme != this.LexemeSemicolon)
          return this.makeResult(this.ResultExceptedSemicolon);
        this.loadLexeme();
        break;
      case this.LexemeIf:
        this.loadLexeme();
        if(this.lexeme != this.LexemeLeftParenthesesns)
          return this.makeResult(this.ResultExceptedLeftParentheses);
        this.loadLexeme();
        result = this.parserCondition();
        if(result !== true)
          return result;
        if(this.lexeme != this.LexemeRightParenthesesrens)
          return this.makeResult(this.ResultExceptedRightParentheses);
        var elseAddress = this.addToCode(-1);
        this.loadLexeme();
        result = this.parserStatment();
        if(result !== true)
          return result;
        switch(this.lexeme)
        {
          case this.LexemeElse:
            this.addToCode(this.machine.CodeJump);
            toOutAddress = this.addToCode(-1);
            this.code[elseAddress] = this.address;
            this.loadLexeme();
            result = this.parserStatment();
            if(result !== true)
              return result;
            this.code[toOutAddress] = this.address;
            break;
          case this.LexemeLeftBraces:
          case this.LexemeRightBraces:
          case this.LexemeSemicolon:
          case this.LexemeName:
          case this.LexemeBreak:
          case this.LexemeContinue:
          case this.LexemeIf:
          case this.LexemeLeft:
          case this.LexemeLoop:
          case this.LexemeMove:
          case this.LexemePut:
          case this.LexemeRepeat:
          case this.LexemeReturn:
          case this.LexemeStop:
          case this.LexemeTake:
          case this.LexemeWhile:
            this.code[elseAddress] = this.address;
            break;
          default:
            return this.makeResult(this.ResultExceptedElseOrCommand);
        }
        break;
      case this.LexemeWhile:
        loopAddress = this.address;
        this.loadLexeme();
        if(this.lexeme != this.LexemeLeftParenthesesns)
          return this.makeResult(this.ResultExceptedLeftParentheses);
        this.loadLexeme();
        result = this.parserCondition();
        if(result !== true)
          return result;
        if(this.lexeme != this.LexemeRightParenthesesrens)
          return this.makeResult(this.ResultExceptedRightParentheses);
        toOutAddress = this.addToCode(-1);
        this.addToLoopInfo(this.LoopTypeWhile);
        this.loadLexeme();
        result = this.parserStatment();
        if(result !== true)
          return result;
        this.addToCode(this.machine.CodeJump);
        this.addToCode(loopAddress);
        this.code[toOutAddress] = this.address;
        loopInfoTop = this.loopInfo.pop();
        for(var i = 0; i < loopInfoTop.breakAddress.length; i++)
          this.code[loopInfoTop.breakAddress[i]] = this.address;
        for(var i = 0; i < loopInfoTop.continueAddress.length; i++)
          this.code[loopInfoTop.continueAddress[i]] = loopAddress;
        break;
      case this.LexemeLoop:
        loopAddress = this.address;
        this.addToLoopInfo(this.LoopTypeLoop);
        this.loadLexeme();
        result = this.parserStatment();
        if(result !== true)
          return result;
        this.addToCode(this.machine.CodeJump);
        this.addToCode(loopAddress);
        loopInfoTop = this.loopInfo.pop();
        for(var i = 0; i < loopInfoTop.breakAddress.length; i++)
          this.code[loopInfoTop.breakAddress[i]] = this.address;
        for(var i = 0; i < loopInfoTop.continueAddress.length; i++)
          this.code[loopInfoTop.continueAddress[i]] = loopAddress;
        break;
      case this.LexemeRepeat:
        this.addToCode(this.machine.CodeRep);
        this.loadLexeme();
        if(this.lexeme != this.LexemeLeftParenthesesns)
          return this.makeResult(this.ResultExceptedLeftParentheses);
        this.loadLexeme();
        if(this.lexeme != this.LexemeNumber)
          return this.makeResult(this.ResultExceptedNumber);
        var number = parseInt(this.lexemeValue);
        if(number <= 0)
          return this.makeResult(this.ResultExceptedPositiveNumber);
        this.addToCode(number-1);
        this.loadLexeme();
        if(this.lexeme != this.LexemeRightParenthesesrens)
          return this.makeResult(this.ResultExceptedRightParentheses);
        loopAddress = this.address;
        this.addToLoopInfo(this.LoopTypeRepeat);
        this.loadLexeme();
        result = this.parserStatment();
        if(result !== true)
          return result;
        var continueAddress = this.addToCode(this.machine.CodeNext);
        this.addToCode(loopAddress);
        loopInfoTop = this.loopInfo.pop();
        for(var i = 0; i < loopInfoTop.breakAddress.length; i++)
          this.code[loopInfoTop.breakAddress[i]] = this.address;
        for(var i = 0; i < loopInfoTop.continueAddress.length; i++)
          this.code[loopInfoTop.continueAddress[i]] = continueAddress;
        break;
      case this.LexemeLeftBraces:
        result = this.parserBlock();
        if(result !== true)
          return result;
        break;
      default:
        return this.makeResult(this.ResultExceptedCommand);
    }
    return true;
  };

  this.parserBlock = function()
  {
    if(this.lexeme != this.LexemeLeftBraces)
      return this.makeResult(this.ResultExceptedLeftBraces);
    this.loadLexeme();
    while
    (
      this.lexeme == this.LexemeLeftBraces ||
      this.lexeme == this.LexemeSemicolon ||
      this.lexeme == this.LexemeName ||
      this.lexeme == this.LexemeBreak ||
      this.lexeme == this.LexemeContinue ||
      this.lexeme == this.LexemeIf ||
      this.lexeme == this.LexemeLeft ||
      this.lexeme == this.LexemeLoop ||
      this.lexeme == this.LexemeMove ||
      this.lexeme == this.LexemePut ||
      this.lexeme == this.LexemeRepeat ||
      this.lexeme == this.LexemeReturn ||
      this.lexeme == this.LexemeStop ||
      this.lexeme == this.LexemeTake ||
      this.lexeme == this.LexemeWhile
    )
    {
      var result = this.parserStatment();
      if(result !== true)
        return result;
    }
    if(this.lexeme != this.LexemeRightBraces)
      return this.makeResult(this.ResultExceptedRightBraces);
    this.loadLexeme();
    return true;
  };

  this.parserFunction = function()
  {
    if(this.lexeme != this.LexemeName)
      return this.makeResult(this.ResultExceptedFucntionName);
    if(this.addToFunctionAddressTable(this.lexemeValue, this.address))
      return this.makeResult(this.ResultExceptedAlreadyDefinedFunction.replace('{}', this.lexemeValue));
    this.loadLexeme();
    if(this.lexeme != this.LexemeLeftParenthesesns)
      return this.makeResult(this.ResultExceptedLeftParentheses);
    this.loadLexeme();
    if(this.lexeme != this.LexemeRightParenthesesrens)
      return this.makeResult(this.ResultExceptedRightParentheses);
    this.loadLexeme();
    var result = this.parserBlock();
    if(result !== true)
      return result;
    this.addToCode(this.machine.CodeRet);
    return true;
  };

  this.parserProgram = function()
  {
    do
    {
      var result = this.parserFunction();
      if(result !== true)
        return result;
    }
    while(this.lexeme == this.LexemeName);
    if(this.lexeme != this.LexemeEnd)
      return this.makeResult(this.ResultExceptedFucntionName);
    return true;
  };

  this.compile = function(text)
  {
    this.text = text;
    this.textPosition = 0;
    this.textLine = 1;
    this.textColumn = 1;

    this.code = [];
    this.address = 0;
    this.callTable = [];
    this.functionAddressTable = [];
    this.addressFunctionTable = [];
    this.loopInfo = [];

    this.machine.unSet();

    this.addToCode(this.machine.CodeCall);
    this.addTocallTable('main', this.addToCode(-1), undefined, undefined);
    this.addToCode(this.machine.CodeStop);

    this.loadLexeme();
    var result = this.parserProgram();
    if(result !== true)
      return result;

    for(var i = 0; i < this.callTable.length; i++)
    {
      if(Object.keys(this.functionAddressTable).indexOf(this.callTable[i].name) < 0)
      {
        var returnValue = this.ResultExceptedUndefinedFunction.replace('{}', this.callTable[i].name);
        if
        (
          this.callTable[i].lexemeLine !== undefined &&
          this.callTable[i].lexemeColumn !== undefined
        )
          returnValue += ' at '+this.callTable[i].line+':'+this.callTable[i].column;
        return returnValue;
      }
      this.code[this.callTable[i].address] = this.functionAddressTable[this.callTable[i].name];
    }
    this.machine.set(this.code, this.addressFunctionTable);
    return true;
  };
}
