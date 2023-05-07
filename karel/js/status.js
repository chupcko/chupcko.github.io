function StatusClass(settings, containerID)
{
  this.settings = settings;
  this.container = document.getElementById(containerID);
  this.container.addEventListener
  (
    'click',
    (
      function(that)
      {
        return function(event)
        {
          that.clear();
          return false;
        };
      }
    )(this),
    false
  );

  this.timer = undefined;

  this.timerStop = function()
  {
    if(this.timer !== undefined)
    {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  };

  this.timerStart = function()
  {
    if(this.timer === undefined)
      this.timer = setTimeout
      (
        (
          function(that)
          {
            return function()
            {
              that.clear();
            };
          }
        )(this),
        this.settings.statusTimerMilliseconds
      );
  };

  this.clear = function()
  {
    this.timerStop();
    this.container.innerHTML = '&nbsp;';
  };

  this.setMessage = function(text)
  {
    this.timerStop();
    this.container.innerHTML = '<span class="status_messaage">'+text+'</span>';
    this.timerStart();
  };

  this.setWarning = function(text)
  {
    this.timerStop();
    this.container.innerHTML = '<span class="status_warning">'+text+'</span>';
    this.timerStart();
  };

  this.audioError = new Audio('ogg/error.ogg');

  this.setError = function(text)
  {
    this.timerStop();
    this.container.innerHTML = '<span class="status_error">'+text+'</span>';
    this.audioError.play();
    this.timerStart();
  };

  this.clear();
}
