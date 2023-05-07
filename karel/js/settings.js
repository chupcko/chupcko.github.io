function SettingsClass()
{
  this.statusTimerMillisecondsDefault = 5000;
  this.runnerJobMillisecondsDefault = 50;

  this.statusTimerMilliseconds = this.statusTimerMillisecondsDefault;
  this.runnerJobMilliseconds = this.runnerJobMillisecondsDefault;

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
    this.putCookie('karel_status_timer_milli_seconds', this.statusTimerMilliseconds);
    this.putCookie('karel_runner_job_milli_seconds', this.runnerJobMilliseconds);
  };

  this.loadFromCookie = function()
  {
    var value;
    value = this.getCookie('karel_status_timer_milli_seconds');
    if(value !== undefined)
      this.statusTimerMilliseconds = parseInt(value);
    value = this.getCookie('karel_runner_job_milli_seconds');
    if(value !== undefined)
      this.runnerJobMilliseconds = parseInt(value);
    this.saveToCookie();
  };

  this.setStatusTimerMilliseconds = function(value)
  {
    this.statusTimerMilliseconds = value;
    this.saveToCookie();
  };

  this.resetStatusTimerMilliseconds = function()
  {
    this.statusTimerMilliseconds = this.statusTimerMillisecondsDefault;
    this.saveToCookie();
  };

  this.setRunnerJobMilliseconds = function(value)
  {
    this.runnerJobMilliseconds = value;
    this.saveToCookie();
  };

  this.resetRunnerJobMilliseconds = function()
  {
    this.runnerJobMilliseconds = this.runnerJobMillisecondsDefault;
    this.saveToCookie();
  };

  this.loadFromCookie();
}
