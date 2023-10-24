const example = require("./retries");

async function main() {
  return example.main();
}

main()
  .then(() => "DONE")
  .catch((err) => console.log(err));
