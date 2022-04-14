function SettingsViewClass(settings, containerID)
{
  this.settings = settings;
  this.container = document.getElementById(containerID);

  this.statusTimerMilliSecondsMin = 1000;
  this.runnerJobMilliSecondsMin   = 5;

  this.init = function()
  {
    this.container.innerHTML =
      '<table style="border-collapse: collapse;"><tr>'+
      '<td>Status timer in milli seconds ( &ge; '+this.statusTimerMilliSecondsMin+' ):</td><td>'+
      '<input type="text" id="'+this.$name()+'_status_timer_milli_seconds" class="settings_view_input" onchange="'+this.$name()+'.setStatusTimerMilliSeconds();"/>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.setStatusTimerMilliSeconds();">Set</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.minStatusTimerMilliSeconds();">Min</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.defaultStatusTimerMilliSeconds();">Default</button>'+
      '</td></tr><tr>'+
      '<td>Run pause in milli seconds ( &ge; '+this.runnerJobMilliSecondsMin+' ):</td><td>'+
      '<input type="text" id="'+this.$name()+'_runner_job_milli_seconds" class="settings_view_input" onchange="'+this.$name()+'.setRunnerJobMilliSeconds();"/>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.setRunnerJobMilliSeconds();">Set</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.minRunnerJobMilliSeconds();">Min</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.defaultRunnerJobMilliSeconds();">Default</button>'+
      '</td></tr></table>';
  };

  this.draw = function()
  {
    document.getElementById(this.$name()+'_status_timer_milli_seconds').value = this.settings.statusTimerMilliSeconds;
    document.getElementById(this.$name()+'_runner_job_milli_seconds').value = this.settings.runnerJobMilliSeconds;
  };

  this.setStatusTimerMilliSeconds = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_status_timer_milli_seconds').value);
    if(number < this.statusTimerMilliSecondsMin)
      number = this.statusTimerMilliSecondsMin;
    this.settings.setStatusTimerMilliSeconds(number);
    this.draw();
  };

  this.minStatusTimerMilliSeconds = function()
  {
    this.settings.setStatusTimerMilliSeconds(this.statusTimerMilliSecondsMin);
    this.draw();
  };

  this.defaultStatusTimerMilliSeconds = function()
  {
    this.settings.resetStatusTimerMilliSeconds();
    this.draw();
  };

  this.setRunnerJobMilliSeconds = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_runner_job_milli_seconds').value);
    if(number < this.runnerJobMilliSecondsMin)
      number = this.runnerJobMilliSecondsMin;
    this.settings.setRunnerJobMilliSeconds(number);
    this.draw();
  };

  this.minRunnerJobMilliSeconds = function()
  {
    this.settings.setRunnerJobMilliSeconds(this.runnerJobMilliSecondsMin);
    this.draw();
  };

  this.defaultRunnerJobMilliSeconds = function()
  {
    this.settings.resetRunnerJobMilliSeconds();
    this.draw();
  };

  this.init();
  this.draw();
}
