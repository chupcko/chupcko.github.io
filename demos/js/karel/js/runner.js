function RunnerClass(settings, status, machine, worldView, machineView)
{
  this.settings = settings;
  this.status = status;
  this.machine = machine;
  this.worldView = worldView;
  this.machineView = machineView;

  this.do = function()
  {
    var result = this.machine.step();
    if(result === false)
      this.status.setMessage('Machine stopped');
    else if(result !== true)
      this.status.setError(result);
    worldView.drawWorld();
    worldView.drawController();
    machineView.draw();
  };

  this.job = undefined;

  this.stop = function()
  {
    if(this.job !== undefined)
    {
      clearInterval(this.job);
      this.job = undefined;
    }
  };

  this.start = function()
  {
    if(this.job === undefined)
      this.job = setInterval
      (
        (
          function(that)
          {
            return function()
            {
              that.do();
              if(that.machine.stopped)
                that.stop();
            };
          }
        )(this),
        this.settings.runnerJobMilliSeconds
      );
  };

  this.reset = function()
  {
    this.status.clear();
    this.machine.reset();
    this.machineView.draw();
  };

  this.runStop = function()
  {
    this.status.clear();
    if(this.job === undefined)
      this.start();
    else
      this.stop();
  };

  this.step = function()
  {
    this.status.clear();
    if(this.job === undefined)
      this.do();
  };
}
