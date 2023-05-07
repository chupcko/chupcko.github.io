function FileViewClass(status, file, containerID)
{
  this.status = status;
  this.file = file;
  this.container = document.getElementById(containerID);

  this.programFileName = 'name.kp';
  this.worldFileName = 'name.kw';

  this.examples =
  [
    'fill',
    'go_home',
    'labyrinth',
    'sierpinski',
    'sort',
    'spiral',
    'take_all_beeperes'
  ];

  this.init = function()
  {
    var text =
      '<button type="button" class="file_view_button" onclick="'+this.$name()+'.loadProgram();">Load program</button><input type="file" id="'+this.$name()+'_program_file"/><br/>'+
      '<button type="button" class="file_view_button" onclick="'+this.$name()+'.loadWorld();">Load world</button><input type="file" id="'+this.$name()+'_world_file"/><br/>'+
      '<button type="button" class="file_view_button" onclick="'+this.$name()+'.saveProgram();">Save program</button><input type="text" id="'+this.$name()+'_program_file_name"/><br/>'+
      '<button type="button" class="file_view_button" onclick="'+this.$name()+'.saveWorld();">Save world</button><input type="text" id="'+this.$name()+'_world_file_name"/><br/>'+
      '<p/>'+
      'Examples:'+
      '<table style="border-collapse: collapse;">';
    for(var i = 0; i < this.examples.length; i++)
      text +=
        '<tr><td>'+this.examples[i]+'</td>'+
        '<td><button type="button" onclick="'+this.$name()+'.getProgram(\''+this.examples[i]+'\');">Get program</button></td>'+
        '<td><button type="button" onclick="'+this.$name()+'.getWorld(\''+this.examples[i]+'\');">Get world</button></td>'+
        '<td><button type="button" onclick="'+this.$name()+'.getBoth(\''+this.examples[i]+'\');">Get program and world</button></td>'+
        '</tr>';
    text += '</table>';
    this.container.innerHTML = text;
  };

  this.draw = function()
  {
    document.getElementById(this.$name()+'_program_file_name').value = this.programFileName;
    document.getElementById(this.$name()+'_world_file_name').value = this.worldFileName;
  };

  this.loadProgram = function()
  {
    var files = document.getElementById(this.$name()+'_program_file').files;
    if(files.length < 1)
    {
      this.status.setError('First select program file');
      return;
    }
    this.file.loadProgram(files);
    this.programFileName = files[0].name;
    this.draw();
  };

  this.loadWorld = function()
  {
    var files = document.getElementById(this.$name()+'_world_file').files;
    if(files.length < 1)
    {
      this.status.setError('First select world file');
      return;
    }
    this.file.loadWorld(files);
    this.worldFileName = files[0].name;
    this.draw();
  };

  this.saveProgram = function()
  {
    this.file.saveProgram(document.getElementById(this.$name()+'_program_file_name').value);
  };

  this.saveWorld = function()
  {
    this.file.saveWorld(document.getElementById(this.$name()+'_world_file_name').value);
  };

  this.getProgram = function(name)
  {
    this.file.getProgram('examples/'+name+'.kp');
    this.programFileName = name+'.kp';
    this.draw();
  };

  this.getWorld = function(name)
  {
    this.file.getWorld('examples/'+name+'.kw');
    this.worldFileName = name+'.kw';
    this.draw();
  };

  this.getBoth = function(name)
  {
    this.getProgram(name);
    this.getWorld(name);
  };

  this.init();
  this.draw();
}
