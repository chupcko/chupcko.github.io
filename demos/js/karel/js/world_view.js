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

  this.canvasBackground = undefined;
  this.canvasBackgroundContext = undefined;
  this.canvasScene = undefined;
  this.canvasSceneContext = undefined;
  this.canvasWalls = undefined;
  this.canvasWallsContext = undefined;
  this.canvasWorld = undefined;
  this.canvasWorldContext = undefined;

  this.init = function()
  {
    this.container.innerHTML =
      '<div style="overflow: auto;"><div class="left_div"><div id="'+this.$name()+'_div">'+
      '<canvas style="position: absolute; z-index: 0;" id="'+this.$name()+'_canvas_background"></canvas>'+
      '<canvas style="position: absolute; z-index: 1;" id="'+this.$name()+'_canvas_scene"></canvas>'+
      '<canvas style="position: absolute; z-index: 2;" id="'+this.$name()+'_canvas_walls"></canvas>'+
      '<canvas style="position: absolute; z-index: 3;" id="'+this.$name()+'_canvas_world"></canvas>'+
      '</div></div><div class="left_div"><table style="border-collapse: collapse;"><tr>'+
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

    this.canvasBackground = document.getElementById(this.$name()+'_canvas_background');
    this.canvasBackgroundContext = this.canvasBackground.getContext('2d');
    this.canvasScene = document.getElementById(this.$name()+'_canvas_scene');
    this.canvasSceneContext = this.canvasScene.getContext('2d');
    this.canvasWalls = document.getElementById(this.$name()+'_canvas_walls');
    this.canvasWallsContext = this.canvasWalls.getContext('2d');
    this.canvasWorld = document.getElementById(this.$name()+'_canvas_world');
    this.canvasWorldContext = this.canvasWorld.getContext('2d');
    this.canvasWorld.addEventListener
    (
      'click',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvasWorld.height-1-point.y, 'left');
            return false;
          };
        }
      )(this),
      false
    );
    this.canvasWorld.addEventListener
    (
      'contextmenu',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvasWorld.height-1-point.y, 'right');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
    this.canvasWorld.addEventListener
    (
      'wheel',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            if(event.deltaY < 0)
              that.handleClick(point.x, that.canvasWorld.height-1-point.y, 'wheelUp');
            else if(event.deltaY > 0)
              that.handleClick(point.x, that.canvasWorld.height-1-point.y, 'wheelDown');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
    this.canvasWorld.addEventListener
    (
      'dblclick',
      (
        function(that)
        {
          return function(event)
          {
            var point = that.clickPoint(event);
            that.handleClick(point.x, that.canvasWorld.height-1-point.y, 'double');
            event.preventDefault();
            return false;
          };
        }
      )(this),
      false
    );
    this.set();
  };

  this.set = function()
  {
    this.selectedX = 0;
    this.selectedY = 0;
    this.fieldsWidth = this.wallAddendum+this.world.dimensionX*this.periodicSize+this.lineWidth+this.wallAddendum;
    this.fieldsHeight = this.wallAddendum+this.world.dimensionY*this.periodicSize+this.lineWidth+this.wallAddendum;
    var div = document.getElementById(this.$name()+'_div');
    div.style.width = this.fieldsWidth+'px';
    div.style.height = this.fieldsHeight+'px';
    this.canvasBackground.width = this.fieldsWidth;
    this.canvasBackground.height = this.fieldsHeight;
    this.canvasBackgroundContext.setTransform(1, 0, 0, -1, 0, this.fieldsHeight);
    this.canvasScene.width = this.fieldsWidth;
    this.canvasScene.height = this.fieldsHeight;
    this.canvasSceneContext.setTransform(1, 0, 0, -1, 0, this.fieldsHeight);
    this.canvasWalls.width = this.fieldsWidth;
    this.canvasWalls.height = this.fieldsHeight;
    this.canvasWallsContext.setTransform(1, 0, 0, -1, 0, this.fieldsHeight);
    this.canvasWorld.width = this.fieldsWidth;
    this.canvasWorld.height = this.fieldsHeight;
    this.canvasWorldContext.setTransform(1, 0, 0, -1, 0, this.fieldsHeight);
    this.drawBackground();
    this.drawBorder();
    this.drawLines();
    this.drawMarkers();
    this.drawController();
  };

  this.clickPoint = function(event)
  {
    var x;
    var y;
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
    return {
      x: x-this.canvasWorld.offsetLeft,
      y: y-this.canvasWorld.offsetTop
    };
  };

  this.findPeriodicBox = function(x, y, offsetX, offsetY, sizeX, sizeY, periodicX, periodicY)
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
    var box = this.findPeriodicBox
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
      this.toggleWallOnNorth(box.x, box.y);
      this.drawController();
    }
    box = this.findPeriodicBox
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
      this.toggleWallOnEast(box.x, box.y);
      this.drawController();
    }
    box = this.findPeriodicBox
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
          this.drawBackground();
          break;
        case 'right':
          if(this.boxIsKarel(box))
            this.world.doLeft();
          else
            this.world.setKarelPosition(box.x, box.y);
          this.drawWorld();
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
            this.drawBackground();
          }
          this.drawWorld();
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
            this.drawBackground();
          }
          this.drawWorld();
          break;
        case 'double':
          this.selectedX = box.x;
          this.selectedY = box.y;
          if(this.world.getBeepersNumber(box.x, box.y) > 0)
            this.world.setBeepersNumber(box.x, box.y, 0)
          else
            if(this.boxIsKarel(box))
              this.world.setKarelBeepersNumber(0)
          this.drawBackground();
          this.drawWorld();
          break;
      }
      this.drawController();
    }
  };

  this.drawBackground = function()
  {
    this.canvasBackgroundContext.fillStyle = this.colorBackground;
    this.canvasBackgroundContext.fillRect
    (
      0,
      0,
      this.fieldsWidth,
      this.fieldsHeight
    );
    this.canvasBackgroundContext.fillStyle = this.colorSelectedBackground;
    this.canvasBackgroundContext.fillRect
    (
      this.wallAddendum+this.selectedX*this.periodicSize+this.lineWidth,
      this.wallAddendum+this.selectedY*this.periodicSize+this.lineWidth,
      this.fieldSize,
      this.fieldSize
    );
  };

  this.drawBorder = function()
  {
    this.canvasSceneContext.fillStyle = this.colorWall;
    this.canvasSceneContext.fillRect
    (
      0,
      0,
      this.fieldsWidth,
      this.wallWidth
    );
    this.canvasSceneContext.fillRect
    (
      0,
      this.fieldsHeight-this.wallWidth,
      this.fieldsWidth,
      this.wallWidth
    );
    this.canvasSceneContext.fillRect
    (
      0,
      this.wallWidth,
      this.wallWidth,
      this.fieldsHeight-2*this.wallWidth
    );
    this.canvasSceneContext.fillRect
    (
      this.fieldsWidth-this.wallWidth,
      this.wallWidth,
      this.wallWidth,
      this.fieldsHeight-2*this.wallWidth
    );
  };

  this.drawLines = function()
  {
    this.canvasSceneContext.fillStyle = this.colorLine;
    for(var x = 0; x < this.world.dimensionX-1; x++)
      this.canvasSceneContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize,
        this.wallWidth,
        this.lineWidth,
        this.fieldsHeight-2*this.wallWidth
      );
    for(var y = 0; y < this.world.dimensionY-1; y++)
      this.canvasSceneContext.fillRect
      (
        this.wallWidth,
        this.wallAddendum+(y+1)*this.periodicSize,
        this.fieldsWidth-2*this.wallWidth,
        this.lineWidth
      );
  };

  this.drawMarkers = function()
  {
    this.canvasSceneContext.fillStyle = this.colorMarker;
    for(var x = 0; x < this.world.dimensionX-1; x++)
    {
      this.canvasSceneContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
        this.wallWidth,
        this.wallWidth,
        this.markerOutlet
      );
      this.canvasSceneContext.fillRect
      (
        this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
        this.fieldsHeight-this.wallWidth-this.markerOutlet,
        this.wallWidth,
        this.markerOutlet
      );
    }
    for(var y = 0; y < this.world.dimensionY-1; y++)
    {
      this.canvasSceneContext.fillRect
      (
        this.wallWidth,
        this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
        this.markerOutlet,
        this.wallWidth
      );
      this.canvasSceneContext.fillRect
      (
        this.fieldsWidth-this.wallWidth-this.markerOutlet,
        this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
        this.markerOutlet,
        this.wallWidth
      );
    }
    for(var x = 0; x < this.world.dimensionX-1; x++)
      for(var y = 0; y < this.world.dimensionY-1; y++)
      {
        this.canvasSceneContext.fillRect
        (
          (x+1)*this.periodicSize,
          (y+1)*this.periodicSize-this.markerOutlet,
          this.wallWidth,
          this.wallWidth+2*this.markerOutlet
        );
        this.canvasSceneContext.fillRect
        (
          (x+1)*this.periodicSize-this.markerOutlet,
          (y+1)*this.periodicSize,
          this.wallWidth+2*this.markerOutlet,
          this.wallWidth
        );
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

  this.drawWallOnNorth = function(x, y)
  {
    this.canvasWallsContext.fillStyle = this.colorWall;
    this.canvasWallsContext.fillRect
    (
      this.wallAddendum+x*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
      this.wallWidth
    );
  };

  this.drawWallOnEast = function(x, y)
  {
    this.canvasWallsContext.fillStyle = this.colorWall;
    this.canvasWallsContext.fillRect
    (
      this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
      this.wallAddendum+y*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallWidth,
      this.fieldSize-2*(this.wallAddendum+this.markerOutlet)
    );
  };

  this.toggleWallOnNorth = function(x, y)
  {
    if(this.world.isWallOnNorth(x, y))
      this.drawWallOnNorth(x, y);
    else
      this.canvasWallsContext.clearRect
      (
        this.wallAddendum+x*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
        this.wallAddendum+(y+1)*this.periodicSize-this.lineWidth,
        this.fieldSize-2*(this.wallAddendum+this.markerOutlet),
        this.wallWidth
      );
  };

  this.toggleWallOnEast = function(x, y)
  {
    if(this.world.isWallOnEast(x, y))
      this.drawWallOnEast(x, y);
    else
      this.canvasWallsContext.clearRect
      (
        this.wallAddendum+(x+1)*this.periodicSize-this.lineWidth,
        this.wallAddendum+y*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
        this.wallWidth,
        this.fieldSize-2*(this.wallAddendum+this.markerOutlet)
      );
  };

  this.drawWalls = function()
  {
    this.canvasWallsContext.clearRect
    (
      0,
      0,
      this.fieldsWidth,
      this.fieldsHeight
    );
    for(var x = 0; x < this.world.dimensionX; x++)
      for(var y = 0; y < this.world.dimensionY-1; y++)
        if(this.world.isWallOnNorth(x, y))
          this.drawWallOnNorth(x, y);
    for(var x = 0; x < this.world.dimensionX-1; x++)
      for(var y = 0; y < this.world.dimensionY; y++)
        if(this.world.isWallOnEast(x, y))
          this.drawWallOnEast(x, y);
  };

  this.beeperColor = function(beepers)
  {
    return 'hsl(0, 100%, '+Math.max(76-beepers, 50)+'%)';
  };

  this.drawBeeper = function(x, y, beepers)
  {
    this.canvasWorldContext.fillStyle = this.beeperColor(beepers);
    this.canvasWorldContext.fillRect
    (
      this.wallAddendum+x*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.wallAddendum+y*this.periodicSize+this.lineWidth+this.wallAddendum+this.markerOutlet,
      this.fieldSize-2*(this.markerOutlet+this.wallAddendum),
      this.fieldSize-2*(this.markerOutlet+this.wallAddendum)
    );
  };

  this.drawKarel = function()
  {
    var centerX = this.wallAddendum+this.world.karelX*this.periodicSize+this.lineWidth+((this.fieldSize/2)|0);
    var centerY = this.wallAddendum+this.world.karelY*this.periodicSize+this.lineWidth+((this.fieldSize/2)|0);
    this.canvasWorldContext.beginPath();
    switch(this.world.karelDirection)
    {
      case this.world.DirectionNorth:
        this.canvasWorldContext.moveTo(centerX+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX+this.karelUnitSize+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX-this.karelUnitSize+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        break;
      case this.world.DirectionWest:
        this.canvasWorldContext.moveTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY+0.5);
        this.canvasWorldContext.lineTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY+this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY-this.karelUnitSize+0.5);
        break;
      case this.world.DirectionSouth:
        this.canvasWorldContext.moveTo(centerX+0.5, centerY-this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX+this.karelUnitSize+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX-this.karelUnitSize+0.5, centerY+this.karelUnitRate*this.karelUnitSize+0.5);
        break;
      case this.world.DirectionEast:
        this.canvasWorldContext.moveTo(centerX+this.karelUnitRate*this.karelUnitSize+0.5, centerY+0.5);
        this.canvasWorldContext.lineTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY+this.karelUnitSize+0.5);
        this.canvasWorldContext.lineTo(centerX-this.karelUnitRate*this.karelUnitSize+0.5, centerY-this.karelUnitSize+0.5);
        break;
    }
    this.canvasWorldContext.closePath();
    if(this.world.karelBeepersNumber > 0)
      this.canvasWorldContext.fillStyle = this.beeperColor(this.world.karelBeepersNumber);
    else
      this.canvasWorldContext.fillStyle = this.colorBackground;
    this.canvasWorldContext.fill();
    this.canvasWorldContext.strokeStyle = this.colorKarel;
    this.canvasWorldContext.lineWidth = this.karelLineWidth;
    this.canvasWorldContext.lineJoin = 'bevel';
    this.canvasWorldContext.stroke();
  };

  this.drawWorld = function()
  {
    this.canvasWorldContext.clearRect
    (
      0,
      0,
      this.fieldsWidth,
      this.fieldsHeight
    );
    for(var x = 0; x < this.world.dimensionX; x++)
      for(var y = 0; y < this.world.dimensionY; y++)
      {
        var beepers = this.world.getBeepersNumber(x, y);
        if(beepers > 0)
          this.drawBeeper(x, y, beepers);
      }
    this.drawKarel();
  };

  this.doLeft = function()
  {
    this.status.clear();
    this.world.doLeft();
    this.drawWorld();
    this.drawController();
  };

  this.doMove = function()
  {
    this.status.clear();
    if(this.world.doMove())
    {
      this.drawWorld();
      this.drawController();
    }
    else
      this.status.setError('Cannot do MOVE');
  };

  this.doPut = function()
  {
    this.status.clear();
    if(this.world.doPut())
    {
      this.drawWorld();
      this.drawController();
    }
    else
      this.status.setError('Cannot do PUT');
  };

  this.doTake = function()
  {
    this.status.clear();
    if(this.world.doTake())
    {
      this.drawWorld();
      this.drawController();
    }
    else
      this.status.setError('Cannot do TAKE');
  };

  this.selectKarelField = function()
  {
    this.selectedX = this.world.karelX;
    this.selectedY = this.world.karelY;
    this.drawBackground();
    this.drawController();
  };

  this.selectedBeepersSet = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_selected_beepers').value);
    if(number < 0)
      number = 0;
    this.world.setBeepersNumber(this.selectedX, this.selectedY, number);
    this.drawWorld();
    this.drawController();
  };

  this.selectedBeepersSetZero = function()
  {
    this.world.setBeepersNumber(this.selectedX, this.selectedY, 0);
    this.drawWorld();
    this.drawController();
  };

  this.selectedBeepersDecrement = function()
  {
    this.world.decrementBeepersNumber(this.selectedX, this.selectedY);
    this.drawWorld();
    this.drawController();
  };

  this.selectedBeepersIncrement = function()
  {
    this.world.incrementBeepersNumber(this.selectedX, this.selectedY);
    this.drawWorld();
    this.drawController();
  };

  this.putKarelOnSelectedField = function()
  {
    this.world.setKarelPosition(this.selectedX, this.selectedY);
    this.drawWorld();
    this.drawController();
  };

  this.karelBeepersSet = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_karel_beepers').value);
    if(number < 0)
      number = 0;
    this.world.setKarelBeepersNumber(number);
    this.drawWorld();
    this.drawController();
  };

  this.karelBeepersSetZero = function()
  {
    this.world.setKarelBeepersNumber(0);
    this.drawWorld();
    this.drawController();
  };

  this.karelBeepersDecrement = function()
  {
    this.world.decrementKarelBeepersNumber();
    this.drawWorld();
    this.drawController();
  };

  this.karelBeepersIncrement = function()
  {
    this.world.incrementKarelBeepersNumber();
    this.drawWorld();
    this.drawController();
  };

  this.changeDimensions = function()
  {
    var dimensionX = parseInt(document.getElementById(this.$name()+'_dimensionX').value);
    var dimensionY = parseInt(document.getElementById(this.$name()+'_dimensionY').value);
    if(dimensionX != this.world.dimensionX || dimensionY != this.world.dimensionY)
    {
      this.world.changeDimensions(dimensionX, dimensionY);
      this.set();
    }
    else
      this.drawController();
  };

  this.resetWorld = function()
  {
    this.world.reset();
    this.drawWalls();
    this.drawWorld();
    this.drawController();
  };

  this.storeWorld = function()
  {
    this.world.saveCopiedData();
  };

  this.restoreWorld = function()
  {
    this.world.loadCopiedData();
    this.drawWalls();
    this.drawWorld();
    this.drawController();
  };

  this.init();
}
