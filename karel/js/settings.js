function SettingsClass()
{
  this.statusTimerMilliSecondsDefault = 5000;
  this.runnerJobMilliSecondsDefault = 50;

  this.statusTimerMilliSeconds = this.statusTimerMilliSecondsDefault;
  this.runnerJobMilliSeconds = this.runnerJobMilliSecondsDefault;

  this.CookieExpiresAfterYears = 10;

  this.putCookie = function(name, value)
  {
    var date = new Date();
    date.setFullYear(date.getFullYear()+this.CookieExpiresAfterYears);
    document.cookie = name+'='+value+'; expires='+date.toUTCString()+'; path=/';
  };

  this.getCookie = function(name)
  {
    var regExp = new RegExp('^ *'+name+'=');
    var cookies = document.cookie.split(';');
    for(var i = 0; i < cookies.length; i++)
      if(cookies[i].search(regExp) >= 0)
        return cookies[i].replace(regExp, '');
    return undefined;
  };

  this.saveToCookie = function()
  {
    this.putCookie('karel_status_timer_milli_seconds', this.statusTimerMilliSeconds);
    this.putCookie('karel_runner_job_milli_seconds', this.runnerJobMilliSeconds);
  };

  this.loadFromCookie = function()
  {
    var value;
    value = this.getCookie('karel_status_timer_milli_seconds');
    if(value !== undefined)
      this.statusTimerMilliSeconds = parseInt(value);
    value = this.getCookie('karel_runner_job_milli_seconds');
    if(value !== undefined)
      this.runnerJobMilliSeconds = parseInt(value);
    this.saveToCookie();
  };

  this.setStatusTimerMilliSeconds = function(value)
  {
    this.statusTimerMilliSeconds = value;
    this.saveToCookie();
  };

  this.resetStatusTimerMilliSeconds = function()
  {
    this.statusTimerMilliSeconds = this.statusTimerMilliSecondsDefault;
    this.saveToCookie();
  };

  this.setRunnerJobMilliSeconds = function(value)
  {
    this.runnerJobMilliSeconds = value;
    this.saveToCookie();
  };

  this.resetRunnerJobMilliSeconds = function()
  {
    this.runnerJobMilliSeconds = this.runnerJobMilliSecondsDefault;
    this.saveToCookie();
  };

  this.loadFromCookie();
}
