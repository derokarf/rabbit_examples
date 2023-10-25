// Choose and uncomment example of retrying what you need

const retrayExample = require("./plugin_retry_with_attempts.example");
// const retrayExample = require("./dead_letter_retry_with_attempts");
// const retrayExample = require("./dead_letter_retry_with_attempts_with_routing");
// const retrayExample = require("./dead_letter_retry_with_attempts_with_reject");
// const retrayExample = require("./plugin_retry_with_timestamp.example");

async function main() {
  return retrayExample.run();
}

main()
  .then(() => "DONE")
  .catch((err) => console.log(err));
