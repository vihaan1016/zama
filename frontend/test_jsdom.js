import { JSDOM, VirtualConsole } from 'jsdom';

const virtualConsole = new VirtualConsole();
virtualConsole.on("error", (...args) => {
  console.log("JSDOM ERROR:", ...args);
});
virtualConsole.on("warn", (...args) => {
  console.log("JSDOM WARN:", ...args);
});
virtualConsole.on("info", (...args) => {
  console.log("JSDOM INFO:", ...args);
});
virtualConsole.on("log", (...args) => {
  console.log("JSDOM LOG:", ...args);
});

(async () => {
  try {
    const dom = await JSDOM.fromURL("http://localhost:5173/", {
      runScripts: "dangerously",
      resources: "usable",
      virtualConsole
    });
    
    // Wait a bit for scripts to load and execute
    setTimeout(() => {
        console.log("DONE WAITING");
    }, 5000);
  } catch (err) {
    console.log("Failed to load JSDOM:", err);
  }
})();
