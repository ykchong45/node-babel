const events = [
    'event flashArbitrageSwapPath(address inToken, uint amountIn, address outToken, address[] allPath, uint[] XiArr);',
    'event Approval(address indexed owner, address indexed spender, uint value);',
    'event Transfer(address indexed from, address indexed to, uint value);',
    'event Mint(address indexed sender, uint amount0, uint amount1);', 
    'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);', 
    'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to);', 
    'event Sync(uint112 reserve0, uint112 reserve1);'
  ]
  
  // clean event string
  for (let [idx, e] of events.entries()) {
    events[idx] = e.replace(/, /g, ",");
  }
  console.log("cleaned string", events);
  
  // get event name and params
  const getEventInfo = (e) => {
    const reg = /event (\w+)\((.+)\)/;
    const m = e.match(reg)
    
    const eName = m[1];
    const eParams = m[2].split(",");
    const eventInfo = [];
    for (let typeParamPair of eParams) {
      let infos = typeParamPair.split(" ");
      let type = infos[0];
      let name = infos[infos.length-1];
      if (type == 'uint') type = 'uint256';
      let indexed = infos.length == 3;
      if (indexed) eventInfo.push({type, name, indexed});
      else eventInfo.push({type, name})
    }
    return {name: eName, info: eventInfo}
  }
  
  const eventsInfo = {};
  for (let e of events) {
    const {name, info} = getEventInfo(e);
    eventsInfo[name] = info;
  }
  
  console.log(eventsInfo)
  
  