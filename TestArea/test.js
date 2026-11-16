function Timer() {
    const seconds = {second: 0};
  
    setInterval(()=>{
      seconds.seconds++; // 화살표 함수에서 'this'는 외부 `this`를 참조
      console.log(seconds.seconds);
    }, 1000);
  }
  
const timer = new Timer();
