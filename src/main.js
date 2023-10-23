const rabbit = require("./retries/rabbit_init");

async function main() {
  return rabbit.initQueues();
}

main()
  .then(() => "DONE")
  .catch((err) => console.log(err));
