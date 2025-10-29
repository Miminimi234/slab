import fetch from 'node-fetch';

const response = await fetch("http://localhost:5000/api/gmgn/tokens");
const data = await response.json();
console.log("Completed tokens sample:", JSON.stringify(data.completed.slice(0, 2), null, 2));
console.log("\nNear completion sample:", JSON.stringify(data.nearCompletion.slice(0, 1), null, 2));
console.log("\nNew tokens sample:", JSON.stringify(data.new.slice(0, 1), null, 2));