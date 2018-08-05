function FileClass(status, programID, world, machine, compiler, worldView, machineView)
{
  this.status = status;
  this.program = document.getElementById(programID);
  this.world = world;
  this.machine = machine;
  this.compiler = compiler;
  this.worldView = worldView;
  this.machineView = machineView;

  this.load = function(files, callback)
  {
    this.status.clear();
    if(files.length < 1)
    {
      this.status.setError('First select file');
      return;
    }
    if(files.length > 1)
    {
      this.status.setError('Select only one file');
      return;
    }
    var reader = new FileReader();
    reader.onerror =
    (
      function(that)
      {
        return function(event)
        {
          that.status.setError('Error in loading');
        };
      }
    )(this);
    reader.onload =
    (
      function(that)
      {
        return function(event)
        {
          var result = callback(reader.result);
          if(result === true)
            that.status.setMessage('Loaded');
          else
            that.status.setError(result);
        };
      }
    )(this);
    reader.readAsText(files[0]);
  };

  this.save = function(name, content)
  {
    this.status.clear();
    var blob = new Blob([ content ], { type: 'text/plain' });
    var download = document.createElement('a');
    download.download = name;
    download.innerHTML = '';
    if(window.URL === undefined)
      window.URL = window.webkitURL;
    download.href = window.URL.createObjectURL(blob);
    download.onclick = function(event)
    {
      document.body.removeChild(event.target);
    };
    download.style.display = 'none';
    document.body.appendChild(download);
    download.click();
    this.status.setMessage('Saved');
  };

  this.get = function(url, callback)
  {
    this.status.clear();
    var xhttp = new XMLHttpRequest();
    xhttp.onerror =
    (
      function(that)
      {
        return function(event)
        {
          that.status.setError('Error in get');
        };
      }
    )(this);
    xhttp.onload =
    (
      function(that)
      {
        return function(event)
        {
          var result = callback(this.response);
          if(result === true)
            that.status.setMessage('Loaded');
          else
            that.status.setError(result);
        }
      }
    )(this);
    xhttp.open('GET', url, true);
    xhttp.send();
  };

  this.programCallback =
  (
    function(that)
    {
      return function(text)
      {
        that.program.value = text;
        that.machine.unSet();
        that.machineView.init();
        return true;
      }
    }
  )(this);

  this.worldCallback =
  (
    function(that)
    {
      return function(text)
      {
        var data;
        try
        {
          data = JSON.parse(text);
        }
        catch(error)
        {
          return 'Bad world file format';
        }
        var result = that.world.load(data);
        if(result !== true)
          return 'Bad world file format: '+result;
        that.worldView.set();
        that.worldView.drawWalls();
        that.worldView.drawWorld();
        that.worldView.drawController();
        return true;
      }
    }
  )(this);

  this.loadProgram = function(files)
  {
    this.load(files, this.programCallback);
  };

  this.loadWorld = function(files)
  {
    this.load(files, this.worldCallback);
  };

  this.saveProgram = function(name)
  {
    this.save(name, this.program.value);
  };

  this.saveWorld = function(name)
  {
    this.save(name, JSON.stringify(world.save()));
  };

  this.getProgram = function(url)
  {
    this.get(url, this.programCallback);
  };

  this.getWorld = function(url)
  {
    this.get(url, this.worldCallback);
  };

  this.compile = function()
  {
    this.status.clear();
    var result = this.compiler.compile(this.program.value);
    if(result !== true)
    {
      this.status.setError(result);
      this.machineView.init();
      return;
    }
    this.status.setMessage('Compiled');
    this.machineView.init();
    this.machineView.draw();
  };
}
