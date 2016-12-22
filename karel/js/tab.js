function tabNothing()
{
}

function tabOpen(event, tabID)
{
  var tabLinks = document.getElementsByClassName('tab_link');
  for(var i = 0; i < tabLinks.length; i++)
    tabLinks[i].className = tabLinks[i].className.replace(' tab_active', '');
  event.currentTarget.className += ' tab_active';
  var tabContents = document.getElementsByClassName('tab_content');
  for(var i = 0; i < tabContents.length; i++)
    tabContents[i].style.display = 'none';
  document.getElementById(tabID).style.display = 'block';
}
