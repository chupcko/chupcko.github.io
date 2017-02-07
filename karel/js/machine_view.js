function MachineViewClass(machine, containerID)
{
  this.machine = machine;
  this.container = document.getElementById(containerID);

  this.oldPC = undefined;

  this.init = function()
  {
    if(this.machine.code === undefined)
    {
      this.container.innerHTML = 'Not yet compiled';
      return;
    }
    var text = '<div style="overflow: auto;"><div class="left_div"><table style="border-collapse: collapse;">';
    for(var i = 0; i < this.machine.code.length; i++)
    {
      text += '<tr id="'+this.$name()+'_code_row_'+i+'"><td class="machine_view_code_address_cell">';
      if(this.machine.addressFunctionTable[i] !== undefined)
        text += '['+this.machine.addressFunctionTable[i]+'] ';
      text += i+':</td><td class="machine_view_code_code_cell">&nbsp;'+this.machine.code[i]+'</td><td>';
      if(i+1 < this.machine.code.length && typeof this.machine.code[i+1] == 'number')
      {
        var functionName = this.machine.addressFunctionTable[this.machine.code[i+1]];
        if(this.machine.code[i] == this.machine.CodeCall && functionName !== undefined)
          text += '['+functionName+'] ';
        text += this.machine.code[i+1];
        i++;
      }
      else
        text += '&nbsp;';
      text += '</td></tr>';
    }
    text +=
      '</table></div><div class="left_div"><table style="border-collapse: collapse;">'+
      '<tr><td>PC</td><td>= <span id="'+this.$name()+'_pc" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Stopped</td><td>= <span id="'+this.$name()+'_stopped" class="machine_view_data"></span></td></tr>'+
      '<tr><td>&nbsp;</td><td class="machine_view_data_width">&nbsp;</td></tr>'+
      '<tr><td>Count of tick</td><td>= <span id="'+this.$name()+'_statisticsCounterTick" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of do LEFT</td><td>= <span id="'+this.$name()+'_statisticsCounterDoLeft" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of do MOVE</td><td>= <span id="'+this.$name()+'_statisticsCounterDoMove" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of do PUT</td><td>= <span id="'+this.$name()+'_statisticsCounterDoPut" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of do TAKE</td><td>= <span id="'+this.$name()+'_statisticsCounterDoTake" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of test NORTH</td><td>= <span id="'+this.$name()+'_statisticsCounterTestNorth" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of test WALL</td><td>= <span id="'+this.$name()+'_statisticsCounterTestWall" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of test HAVE</td><td>= <span id="'+this.$name()+'_statisticsCounterTestHave" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of test FIND</td><td>= <span id="'+this.$name()+'_statisticsCounterTestFind" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Count of call</td><td>= <span id="'+this.$name()+'_statisticsCounterCall" class="machine_view_data"></span></td></tr>'+
      '<tr><td>Max stack depth</td><td>= <span id="'+this.$name()+'_statisticsMaxStackDepth" class="machine_view_data"></span></td></tr>'+
      '</table></div><div class="left_div">'+
      'Stack (size = <span id="'+this.$name()+'_stack_size" class="machine_view_data"></span>):'+
      '<div id="'+this.$name()+'_stack" class="machine_view_stack"></div>'+
      '</div></div>';
    this.container.innerHTML = text;
    this.oldPC = undefined;
  };

  this.draw = function()
  {
    if(this.machine.code === undefined)
      return;
    if(this.oldPC !== undefined)
      document.getElementById(this.$name()+'_code_row_'+this.oldPC).className = document.getElementById(this.$name()+'_code_row_'+this.oldPC).className.replace('machine_view_code_pc_row', '');
    if(this.machine.pc !== undefined)
      document.getElementById(this.$name()+'_code_row_'+this.machine.pc).className += 'machine_view_code_pc_row';

    document.getElementById(this.$name()+'_pc').innerHTML = this.machine.pc;
    document.getElementById(this.$name()+'_stopped').innerHTML = this.machine.stopped;
    this.oldPC = this.machine.pc;

    document.getElementById(this.$name()+'_statisticsCounterTick').innerHTML = this.machine.statistics.counterTick;
    document.getElementById(this.$name()+'_statisticsCounterDoLeft').innerHTML = this.machine.statistics.counterDoLeft;
    document.getElementById(this.$name()+'_statisticsCounterDoMove').innerHTML = this.machine.statistics.counterDoMove;
    document.getElementById(this.$name()+'_statisticsCounterDoPut').innerHTML = this.machine.statistics.counterDoPut;
    document.getElementById(this.$name()+'_statisticsCounterDoTake').innerHTML = this.machine.statistics.counterDoTake;
    document.getElementById(this.$name()+'_statisticsCounterTestNorth').innerHTML = this.machine.statistics.counterTestNorth;
    document.getElementById(this.$name()+'_statisticsCounterTestWall').innerHTML = this.machine.statistics.counterTestWall;
    document.getElementById(this.$name()+'_statisticsCounterTestHave').innerHTML = this.machine.statistics.counterTestHave;
    document.getElementById(this.$name()+'_statisticsCounterTestFind').innerHTML = this.machine.statistics.counterTestFind;
    document.getElementById(this.$name()+'_statisticsCounterCall').innerHTML = this.machine.statistics.counterCall;
    document.getElementById(this.$name()+'_statisticsMaxStackDepth').innerHTML = this.machine.statistics.maxStackDepth;

    document.getElementById(this.$name()+'_stack_size').innerHTML = this.machine.stack.length;
    if(this.machine.stack.length > 0)
    {
      var text = '';
      for(var i = this.machine.stack.length-1; i >= 0; i--)
        switch(this.machine.stack[i].type)
        {
          case this.machine.StackTypeNumber:
            text += '&nbsp;&nbsp;(number) '+this.machine.stack[i].data+'<br/>';
            break;
          case this.machine.StackTypeAddress:
            var functionAddress = this.machine.code[this.machine.stack[i].data-1];
            var functionName = undefined;
            if(typeof functionAddress == 'number')
              functionName = this.machine.addressFunctionTable[functionAddress];
            text += '&nbsp;&nbsp;(address) '+this.machine.stack[i].data;
            if(functionName !== undefined)
              text += ' ['+functionName+']';
            text += '<br/>';
            break;
        }
      document.getElementById(this.$name()+'_stack').innerHTML = text;
    }
    else
      document.getElementById(this.$name()+'_stack').innerHTML = '&nbsp;&nbsp;Empty<br/>';
  };

  this.init();
}
