function SettingsViewClass(settings, containerID)
{
  this.settings = settings;
  this.container = document.getElementById(containerID);

  this.statusTimerMillisecondsMin = 1000;
  this.runnerJobMillisecondsMin   = 5;

  this.init = function()
  {
    this.container.innerHTML =
      '<table style="border-collapse: collapse;"><tr>'+
      '<td>Status timer in milliseconds ( &ge; '+this.statusTimerMillisecondsMin+' ):</td><td>'+
      '<input type="text" id="'+this.$name()+'_status_timer_milli_seconds" class="settings_view_input" onchange="'+this.$name()+'.setStatusTimerMilliseconds();"/>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.setStatusTimerMilliseconds();">Set</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.minStatusTimerMilliseconds();">Min</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.defaultStatusTimerMilliseconds();">Default</button>'+
      '</td></tr><tr>'+
      '<td>Run pause in milliseconds ( &ge; '+this.runnerJobMillisecondsMin+' ):</td><td>'+
      '<input type="text" id="'+this.$name()+'_runner_job_milli_seconds" class="settings_view_input" onchange="'+this.$name()+'.setRunnerJobMilliseconds();"/>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.setRunnerJobMilliseconds();">Set</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.minRunnerJobMilliseconds();">Min</button>'+
      '<button type="button" class="settings_view_button" onclick="'+this.$name()+'.defaultRunnerJobMilliseconds();">Default</button>'+
      '</td></tr></table>';
  };

  this.draw = function()
  {
    document.getElementById(this.$name()+'_status_timer_milli_seconds').value = this.settings.statusTimerMilliseconds;
    document.getElementById(this.$name()+'_runner_job_milli_seconds').value = this.settings.runnerJobMilliseconds;
  };

  this.setStatusTimerMilliseconds = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_status_timer_milli_seconds').value);
    if(number < this.statusTimerMillisecondsMin)
      number = this.statusTimerMillisecondsMin;
    this.settings.setStatusTimerMilliseconds(number);
    this.draw();
  };

  this.minStatusTimerMilliseconds = function()
  {
    this.settings.setStatusTimerMilliseconds(this.statusTimerMillisecondsMin);
    this.draw();
  };

  this.defaultStatusTimerMilliseconds = function()
  {
    this.settings.resetStatusTimerMilliseconds();
    this.draw();
  };

  this.setRunnerJobMilliseconds = function()
  {
    var number = parseInt(document.getElementById(this.$name()+'_runner_job_milli_seconds').value);
    if(number < this.runnerJobMillisecondsMin)
      number = this.runnerJobMillisecondsMin;
    this.settings.setRunnerJobMilliseconds(number);
    this.draw();
  };

  this.minRunnerJobMilliseconds = function()
  {
    this.settings.setRunnerJobMilliseconds(this.runnerJobMillisecondsMin);
    this.draw();
  };

  this.defaultRunnerJobMilliseconds = function()
  {
    this.settings.resetRunnerJobMilliseconds();
    this.draw();
  };

  this.init();
  this.draw();
}
