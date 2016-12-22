function StatisticsClass()
{
  this.counterTick = undefined;
  this.counterDoLeft = undefined;
  this.counterDoMove = undefined;
  this.counterDoPut = undefined;
  this.counterDoTake = undefined;
  this.counterTestNorth = undefined;
  this.counterTestWall = undefined;
  this.counterTestHave = undefined;
  this.counterTestFind = undefined;
  this.counterCall = undefined;
  this.maxStackDepth = undefined;

  this.reset = function()
  {
    this.counterTick = 0;
    this.counterDoLeft = 0;
    this.counterDoMove = 0;
    this.counterDoPut = 0;
    this.counterDoTake = 0;
    this.counterTestNorth = 0;
    this.counterTestWall = 0;
    this.counterTestHave = 0;
    this.counterTestFind = 0;
    this.counterCall = 0;
    this.maxStackDepth = 0;
  };

  this.newStackDepth = function(value)
  {
    this.maxStackDepth = Math.max(this.maxStackDepth, value);
  };

  this.reset();
}
