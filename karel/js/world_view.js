function WorldViewClass(status, world, containerID)
{
  this.status = status;
  this.world = world;
  this.container = document.getElementById(containerID);

  this.selectedX = undefined;
  this.selectedY = undefined;

  this.wallAddendum = 1;
  this.lineWidth = 1;
  this.markerOutlet = 3;
  this.fieldSize = 31;

  this.karelUnitSize = 4.75;
  this.karelUnitRate = 1.75;
  this.karelLineWidth = 2.25;

  this.colorBackground = 'rgb(75%, 75%, 75%)';
  this.colorSelectedBackground = 'hsl(210, 100%, 70%)';
  this.colorWall = 'rgb(0%, 0%, 0%)';
  this.colorLine = 'rgb(50%, 50%, 50%)';
  this.colorMarker = 'rgb(25%, 25%, 25%)';
  this.colorKarel = 'rgb(0%, 0%, 80%)';

  this.wallWidth = this.wallAddendum+this.lineWidth+this.wallAddendum;
  this.periodicSize = this.lineWidth+this.fieldSize;

  this.fieldsWidth = undefined;
  this.fieldsHeight = undefined;

  this.canvas = undefined;
  this.canvasContext = undefined;

  this.init = function()
  {
    this.container.innerHTML =
      '<div class="overflow"><div class="left_div"><canvas id="'+this.$name()+'_canvas"></canvas></div><div class="left_div">'+
      '<table class="border_collapse"><tr>'+
      '<td class="world_view_info">NORTH: <span id="'+this.$name()+'_north" class="world_view_test"></span></td>'+
      '<td class="world_view_info">WALL: <span id="'+this.$name()+'_wall" class="world_view_test"></span></td>'+
      '<td class="world_view_info">HAVE: <span id="'+this.$name()+'_have" class="world_view_test"></span></td>'+
      '<td class="world_view_info">FIND: <span id="'+this.$name()+'_find" class="world_view_test"></span></td>'+
      '</tr><tr>'+
      '<td><button type="button" class="world_view_button_command" onclick="'+this.$name()+'.doLeft();">LEFT</button></td>'+
      '<td><button type="button" class="world_view_button_command" onclick="'+this.$name()+'.doMove();">MOVE</button></td>'+
      '<td><button type="button" class="world_view_button_command" onclick="'+this.$name()+'.doPut();">PUT</button></td>'+
      '<td><button type="button" class="world_view_button_command" onclick="'+this.$name()+'.doTake();">TAKE</button></td>'+
      '</tr></table><br/>'+
      '<button type="button" onclick="'+this.$name()+'.selectKarelField();">Select Karel field</button><br/>'+
      'Selected field at (<span id="'+this.$name()+'_selected_x" class="world_view_data"></span>,<span id="'+this.$name()+'_selected_y" class="world_view_data"></span>) '+
      'have <input type="text" id="'+this.$name()+'_selected_beepers" class="world_view_input" onchange="'+this.$name()+'.selectedBeepersSet();"/> beeper(s)'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.selectedBeepersSet();">Set</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.selectedBeepersSetZero();">=0</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.selectedBeepersDecrement();">-1</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.selectedBeepersIncrement();">+1</button><br/>'+
      '<br/>'+
      '<button type="button" onclick="'+this.$name()+'.putKarelOnSelectedField();">Put Karel on selected field</button><br/>'+
      'Karel at (<span id="'+this.$name()+'_karel_x" class="world_view_data"></span>,<span id="'+this.$name()+'_karel_y" class="world_view_data"></span>) '+
      'have <input type="text" id="'+this.$name()+'_karel_beepers" class="world_view_input" onchange="'+this.$name()+'.karelBeepersSet();"/> beeper(s)'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.karelBeepersSet();">Set</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.karelBeepersSetZero();">=0</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.karelBeepersDecrement();">-1</button>'+
      '<button type="button" class="world_view_button_set" onclick="'+this.$name()+'.karelBeepersIncrement();">+1</button><br/>'+
      '<br/>'+
      'X: <input type="text" id="'+this.$name()+'_dimensionX" class="world_view_input" onchange="'+this.$name()+'.changeDimensions();"/>'+
      'Y: <input type="text" id="'+this.$name()+'_dimensionY" class="world_view_input" onchange="'+this.$name()+'.changeDimensions();"/>'+
      '<button type="button" onclick="'+this.$name()+'.changeDimensions();">Change dimensions</button>&nbsp;&nbsp;'+
      '<button type="button" onclick="'+this.$name()+'.resetWorld();">Reset world</button><br/>'+
      '<br/>'+
      '<button type="button" onclick="'+this.$name()+'.storeWorld();">Store world to memory</button>&nbsp;&nbsp;'+
      '<button type="button" onclick="'+this.$name()+'.restoreWorld();">Restore world from memory</button>'+
      '</div>';
    this.canvas = document.getElementById(this.$name()+'_canvas');
    this.canvasContext = this.canvas.getContext('2d');
    this.canvas.addEventListener
    (
      'click',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvas.height-1-point.y, 'left');
            return false;
          };
        }
      )(this),
      false
    );
    this.canvas.addEventListener
    (
      'contextmenu',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvas.height-1-point.y, 'right');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
    this.canvas.addEventListener
    (
      'wheel',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            if(event.deltaY < 0)
              that.handleClick(point.x, that.canvas.height-1-point.y, 'wheelUp');
            else if(event.deltaY > 0)
              that.handleClick(point.x, that.canvas.height-1-point.y, 'wheelDown');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
    this.canvas.addEventListener
    (
      'dblclick',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvas.height-1-point.y, 'double');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
  };

  this.initCanvas = function()
  {
    this.selectedX = 0;
    this.selectedY = 0;
    this.fieldsWidth = this.wallAddendum+this.world.dimensionX*this.periodicSize+this.lineWidth+this.wallAddendum;
    this.fieldsHeight = this.wallAddendum+this.world.dimensionY*this.periodicSize+this.lineWidth+this.wallAddendum;
    this.canvas.width = this.fieldsWidth;
    this.canvas.height = this.fieldsHeight;
  };

  this.clickPoint = function(event)
  {
    var x = undefined;
    var y = undefined;
    if
    (
      event.pageX !== undefined &&
      event.pageY !== undefined
    )
    {
      x = event.pageX;
      y = event.pageY;
    }
    else
    {
      x = event.clientX+document.body.scrollLeft+document.documentElement.scrollLeft;
      y = event.clientY+document.body.scrollTop+document.documentElement.scrollTop;
    }
    x -= this.canvas.offsetLeft;
    y -= this.canvas.offsetTop;
    return {
      x: x,
      y: y
    };
  };

  this.findClickBox = function(x, y, offsetX, offsetY, sizeX, sizeY, periodicX, periodicY)
  {
    if
    (
      x-offsetX >= 0 &&
      y-offsetY >= 0 &&
      (x-offsetX)%periodicX < sizeX &&
      (y-offsetY)%periodicY < sizeY
    )
      return {
        x: ((x-offsetX)/periodicX)|0,
        y: ((y-offsetY)/periodicY)|0
      };
    return undefined;
  };

  this.boxIsSelected = function(box)
  {
    return box.x == this.selectedX && box.y == this.selectedY;
  };

  this.boxIsKarel = function(box)
  {
    return box.x == this.world.karelX && box.y == this.world.karelY;
  };

  this.handleClick = function(x, y, type)
  {
    var box;
    var box = this.findClickBox
    (
      x,
      y,
      this.wallWidth+this.markerOutlet,
      this.periodicSize-this.markerOutlet,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.lineWidth+2*(this.wallAddendum+this.markerOutlet),
      this.periodicSize,
      this.periodicSize
    );
    if(box !== undefined)
    {
      this.world.toggleWallOnNorth(box.x, box.y);
      this.draw();
    }
    box = this.findClickBox
    (
      x,
      y,
      this.periodicSize-this.markerOutlet,
      this.wallWidth+this.markerOutlet,
      this.lineWidth+2*(this.wallAddendum+this.markerOutlet),
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.periodicSize,
      this.periodicSize
    );
    if(box !== undefined)
    {
      this.world.toggleWallOnEast(box.x, box.y);
      this.draw();
    }
    box = this.findClickBox
    (
      x,
      y,
      this.wallWidth+this.markerOutlet,
      this.wallWidth+this.markerOutlet,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.periodicSize,
      this.periodicSize
    );
    if(box !== undefined)
    {
      switch(type)
      {
        case 'left':
          this.selectedX = box.x;
          this.selectedY = box.y;
          break;
        case 'right':
          if(this.boxIsKarel(box))
            this.world.doLeft();
          else
            this.world.setKarelPosition(box.x, box.y);
          break;
        case 'wheelDown':
          if(this.boxIsKarel(box))
            if(this.boxIsSelected(box))
              this.world.decrementBeepersNumber(box.x, box.y);
            else
              this.world.decrementKarelBeepersNumber();
          else
          {
            this.selectedX = box.x;
            this.selectedY = box.y;
            this.world.decrementBeepersNumber(box.x, box.y);
          }
          break;
        case 'wheelUp':
          if(this.boxIsKarel(box))
            if(this.boxIsSelected(box))
              this.world.incrementBeepersNumber(box.x, box.y);
            else
              this.world.incrementKarelBeepersNumber();
          else
          {
            this.selectedX = box.x;
            this.selectedY = box.y;
            this.world.incrementBeepersNumber(box.x, box.y);
          }
          break;
        case 'double':
          this.selectedX = box.x;
          this.selectedY = box.y;
          if(this.world.getBeepersNumber(box.x, box.y) > 0)
            this.world.setBeepersNumber(box.x, box.y, 0)
          else
            if(this.boxIsKarel(box))
              this.world.setKarelBeepersNumber(0)
          break;
      }
      this.draw();
    }
  };

  this.drawController = function()
  {
    document.getElementById(this.$name()+'_north').innerHTML = this.world.conditionNorth();
    document.getElementById(this.$name()+'_wall').innerHTML = this.world.conditionWall();
    document.getElementById(this.$name()+'_have').innerHTML = this.world.conditionHave();
    document.getElementById(this.$name()+'_find').innerHTML = this.world.conditionFind();
    document.getElementById(this.$name()+'_selected_x').innerHTML = this.selectedX;
    document.getElementById(this.$name()+'_selected_y').innerHTML = this.selectedY;
    document.getElementById(this.$name()+'_selected_beepers').value = this.world.getBeepersNumber(this.selectedX, this.selectedY);
    document.getElementById(this.$name()+'_karel_x').innerHTML = this.world.karelX;
    document.getElementById(this.$name()+'_karel_y').innerHTML = this.world.karelY;
    document.getElementById(this.$name()+'_karel_beepers').value = this.world.karelBeepersNumber;
    document.getElementById(this.$name()+'_dimensionX').value = this.world.dimensionX;
    document.getElementById(this.$name()+'_dimensionY').value = this.world.dimensionY;
  };

  this.drawCanvasSelected = function()
  {
    this.canvasContext.fillStyle = this.colorSelectedBackground;
    this.canvasContext.fillRect
    (
      this.wallAddendum+this.selectedX*this.periodicSize+this.lineWidth,
      this.wallAddendum+this.selectedY*this.periodicSize+this.lineWidth,
      this.fieldSize,
      this.fieldSize
    );
  };

  this.drawCanvasBorder = function()
  {
    this.canvasContext.fillStyle = this.colorWall;
    this.canvasContext.fillRect
    (
      0,
      0,
      this.fieldsWidth,
      this.wallWidth
    );
    this.canvasContext.fillRect
    (
      0,
      this.fieldsHeight-this.wallWidth,
      this.fieldsWidth,
      this.wallWidth
    );
    this.canvasContext.fillRect
    (
      0,
      this.wallWidth,
      this.wallWidth,
      this.fieldsHeight-2*this.wallWidth
    );
    this.canvasContext.fillRect
    (
      this.fieldsWidth-this.wallWidth,
      this.wallWidth,
      this.wallWidth,
      this.fieldsHeight-2*this.wallWidth
    );
  };

  this.drawCanvasLines = function()
  {
    this.canvasContext.fillStyle = this.colorLine;
    for(var x = 0; x < this.world.dimensionX-1; x++)
      this.canvasContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize,
        this.wallWidth,
        this.lineWidth,
        this.fieldsHeight-2*this.wallWidth
      );
    for(var y = 0; y < this.world.dimensionY-1; y++)
      this.canvasContext.fillRect
      (
        this.wallWidth,
        this.wallAddendum+(y+1)*this.periodicSize,
        this.fieldsWidth-2*this.wallWidth,
        this.lineWidth
      );
  };

  this.drawCanvasMarker = function(x, y)
  {
    this.canvasContext.fillStyle = this.colorMarker;
    this.canvasContext.fillRect
    (
      (x+1)*this.periodicSize,
      (y+1)*this.periodicSize-this.markerOutlet,
      this.wallWidth,
      this.wallWidth+2*this.markerOutlet
    );
    this.canvasContext.fillRect
    (
      (x+1)*this.periodicSize-this.markerOutlet,
      (y+1)*this.periodicSize,
      this.wallWidth+2*this.markerOutlet,
      this.wallWidth
    );
  }

  this.drawCanvasMarkers = function()
  {
    this.canvasContext.fillStyle = this.colorMarker;
    for(var x = 0; x < this.world.dimensionX-1; x++)
    {
      this.canvasContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
        this.wallWidth,
        this.wallWidth,
        this.markerOutlet
      );
      this.canvasContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
        this.fieldsHeight-this.wallWidth-this.markerOutlet,
        this.wallWidth,
        this.markerOutlet
      );
    }
    for(var y = 0; y < this.world.dimensionY-1; y++)
    {
      this.canvasContext.fillRect
      (
        this.wallWidth,
        this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
        this.markerOutlet,
        this.wallWidth
      );
      this.canvasContext.fillRect
      (
        this.fieldsWidth-this.wallWidth-this.markerOutlet,
        this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
        this.markerOutlet,
        this.wallWidth
      );
    }
    for(var x = 0; x < this.world.dimensionX-1; x++)
      for(var y = 0; y < this.world.dimensionY-1; y++)
        this.drawCanvasMarker(x, y);
  };

  this.drawCanvasNorthWall = function(x, y)
  {
    this.canvasContext.fillStyle = this.colorWall;
    this.canvasContext.fillRect
    (
      this.wallAddendum+x*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.wallWidth
    );
  };

  this.drawCanvasEastWall = function(x, y)
  {
    this.canvasContext.fillStyle = this.colorWall;
    this.canvasContext.fillRect
    (
      this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
      this.wallAddendum+y*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallWidth,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet)
    );
  };

  this.beeperColor = function(beepers)
  {
    return 'hsl(0, 100%, '+Math.max(76-beepers, 50)+'%)';
  };

  this.drawCanvasBeeper = function(x, y, beepers)
  {
    this.canvasContext.fillStyle = this.beeperColor(beepers);
    this.canvasContext.fillRect
    (
      this.wallAddendum+x*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallAddendum+y*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.fieldSize-2*(this.markerOutlet+this.wallAddendum),
      this.fieldSize-2*(this.markerOutlet+this.wallAddendum)
    );
  };

  this.drawCanvasKarel = function()
  {
    var centerX = this.wallAddendum+this.world.karelX*this.periodicSize+this.lineWidth+((this.fieldSize/2)|0);
    var centerY = this.wallAddendum+this.world.karelY*this.periodicSize+this.lineWidth+((this.fieldSize/2)|0);
    this.canvasContext.beginPath();
    switch(this.world.karelDirection)
    {
      case this.world.DirectionNorth:
        this.canvasContext.moveTo(centerX+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX+this.karelUnitSize+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX-this.karelUnitSize+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        break;
      case this.world.DirectionWest:
        this.canvasContext.moveTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY+0.5);
        this.canvasContext.lineTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY+this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY-this.karelUnitSize+0.5);
        break;
      case this.world.DirectionSouth:
        this.canvasContext.moveTo(centerX+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX+this.karelUnitSize+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX-this.karelUnitSize+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        break;
      case this.world.DirectionEast:
        this.canvasContext.moveTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY+0.5);
        this.canvasContext.lineTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY+this.karelUnitSize+0.5);
        this.canvasContext.lineTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY-this.karelUnitSize+0.5);
        break;
    }
    this.canvasContext.closePath();
    if(this.world.karelBeepersNumber > 0)
      this.canvasContext.fillStyle = this.beeperColor(this.world.karelBeepersNumber);
    else
      this.canvasContext.fillStyle = this.colorBackground;
    this.canvasContext.fill();
    this.canvasContext.strokeStyle = this.colorKarel;
    this.canvasContext.lineWidth = this.karelLineWidth;
    this.canvasContext.lineJoin = 'bevel';
    this.canvasContext.stroke();
  };

  this.drawCanvas = function()
  {
    this.canvasContext.setTransform(1, 0, 0, -1, 0, this.canvas.height);
    this.canvasContext.fillStyle = this.colorBackground;
    this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawCanvasSelected();
    this.drawCanvasBorder();
    this.drawCanvasLines();
    this.drawCanvasMarkers();
    for(var x = 0; x < this.world.dimensionX; x++)
      for(var y = 0; y < this.world.dimensionY-1; y++)
        if(this.world.isWallOnNorth(x, y))
          this.drawCanvasNorthWall(x, y);
    for(var x = 0; x < this.world.dimensionX-1; x++)
      for(var y = 0; y < this.world.dimensionY; y++)
        if(this.world.isWallOnEast(x, y))
          this.drawCanvasEastWall(x, y);
    for(var x = 0; x < this.world.dimensionX; x++)
      for(var y = 0; y < this.world.dimensionY; y++)
      {
        var beepers = this.world.getBeepersNumber(x, y);
        if(beepers > 0)
          this.drawCanvasBeeper(x, y, beepers);
      }
    this.drawCanvasKarel();
  };

  this.draw = function()
  {
    this.drawCanvas();
    this.drawController();
  };

  this.doLeft = function()
  {
    this.status.clear();
    this.world.doLeft();
    this.draw();
  };

  this.doMove = function()
  {
    this.status.clear();
    if(this.world.doMove())
      this.draw();
    else
      this.status.setError('Cannot do MOVE');
  };

  this.doPut = function()
  {
    this.status.clear();
    if(this.world.doPut())
      this.draw();
    else
      this.status.setError('Cannot do PUT');
  };

  this.doTake = function()
  {
    this.status.clear();
    if(this.world.doTake())
      this.draw();
    else
      this.status.setError('Cannot do TAKE');
  };

  this.selectKarelField = function()
  {
    this.selectedX = this.world.karelX;
    this.selectedY = this.world.karelY;
    this.draw();
  };

  this.selectedBeepersSet = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_selected_beepers').value);
    if(number < 0)
      number = 0;
    this.world.setBeepersNumber(this.selectedX, this.selectedY, number);
    this.draw();
  };

  this.selectedBeepersSetZero = function()
  {
    this.world.setBeepersNumber(this.selectedX, this.selectedY, 0);
    this.draw();
  };

  this.selectedBeepersDecrement = function()
  {
    this.world.decrementBeepersNumber(this.selectedX, this.selectedY);
    this.draw();
  };

  this.selectedBeepersIncrement = function()
  {
    this.world.incrementBeepersNumber(this.selectedX, this.selectedY);
    this.draw();
  };

  this.putKarelOnSelectedField = function()
  {
    this.world.setKarelPosition(this.selectedX, this.selectedY);
    this.draw();
  };

  this.karelBeepersSet = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_karel_beepers').value);
    if(number < 0)
      number = 0;
    this.world.setKarelBeepersNumber(number);
    this.draw();
  };

  this.karelBeepersSetZero = function()
  {
    this.world.setKarelBeepersNumber(0);
    this.draw();
  };

  this.karelBeepersDecrement = function()
  {
    this.world.decrementKarelBeepersNumber();
    this.draw();
  };

  this.karelBeepersIncrement = function()
  {
    this.world.incrementKarelBeepersNumber();
    this.draw();
  };

  this.changeDimensions = function()
  {
    var dimensionX = parseInt(document.getElementById(this.$name()+'_dimensionX').value);
    var dimensionY = parseInt(document.getElementById(this.$name()+'_dimensionY').value);
    if(dimensionX != this.world.dimensionX || dimensionY != this.world.dimensionY)
    {
      this.world.changeDimensions(dimensionX, dimensionY);
      this.initCanvas();
      this.drawCanvas();
    }
    this.drawController();
  };

  this.resetWorld = function()
  {
    this.world.reset();
    this.draw();
  };

  this.storeWorld = function()
  {
    this.world.saveCopiedData();
  };

  this.restoreWorld = function()
  {
    this.world.loadCopiedData();
    this.draw();
  };

  this.init();
  this.initCanvas();
  this.draw();
}
