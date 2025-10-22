(function(){
  const compactBackButtons=Array.from(document.querySelectorAll('.back-btn[data-compact-back]'));
  if(compactBackButtons.length){
    const style=document.createElement('style');
    style.textContent=`
      @media (orientation:portrait){
        .back-btn[data-compact-back]{
          width:44px !important;
          min-width:44px !important;
          height:44px !important;
          padding:0 !important;
          border-radius:12px !important;
          font-size:0 !important;
          line-height:1 !important;
          display:inline-flex !important;
          align-items:center;
          justify-content:center;
        }
        .back-btn[data-compact-back]::before{
          content:'\\25C0';
          font-size:22px;
          line-height:1;
        }
        .back-btn[data-compact-back] > *{
          display:none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const navigationBackButton=compactBackButtons[0];
  if(!navigationBackButton) return;

  const GUARD_KEY='__preventBackNavigation';
  let guardActive=false;

  const pushGuardState=()=>{
    if(guardActive) return;
    try{
      guardActive=true;
      const currentState=history.state;
      const baseState=currentState && typeof currentState==='object'?{...currentState}:{};
      if(baseState && baseState[GUARD_KEY]!==true){
        baseState[GUARD_KEY]=true;
        history.replaceState(baseState,document.title);
      }
      history.pushState({[GUARD_KEY]:true},document.title);
    }catch(error){
      console.warn('No se pudo configurar la navegación protegida',error);
    }finally{
      guardActive=false;
    }
  };

  const triggerBackAction=()=>{
    if(!navigationBackButton.isConnected) return;
    if(typeof navigationBackButton.click==='function'){
      navigationBackButton.click();
    }else{
      navigationBackButton.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    }
  };

  pushGuardState();

  window.addEventListener('popstate',event=>{
    if(!navigationBackButton.isConnected) return;
    if(!event || !event.state || event.state[GUARD_KEY]===true){
      pushGuardState();
      triggerBackAction();
      return;
    }
    pushGuardState();
    triggerBackAction();
  });
})();
