(function(){
  'use strict';
  const mode=new URLSearchParams(location.search).get('mode');
  if(mode==='online'){
    if(typeof window.openVersusSelectMenu==='function')window.openVersusSelectMenu();
    window.DV.openOnline();
  }else if(mode==='tournament'){
    window.DV.openTournament();
  }else if(mode==='versus'){
    if(typeof window.openVersusSelectMenu==='function')window.openVersusSelectMenu();
    else window.DV.open();
  }
})();
