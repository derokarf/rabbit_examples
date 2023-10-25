const amqplib = require("amqplib");

console.log(
  "EXAMPLE 1: Retrying with installed delay plugin and control proccess with number of attemts",
);

async function run() {
  const exampleQueue = "test-queue";
  const exampleExchange = "test-exchange";
  const delayedExchange = "delayed-exchange";
  const routingKey = "test";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  await Promise.all([
    rabbitReceiverChannel.deleteQueue(exampleQueue),
    rabbitReceiverChannel.deleteExchange(delayedExchange),
    rabbitReceiverChannel.deleteExchange(exampleExchange),
  ]);

  // Queue
  await rabbitReceiverChannel.assertQueue(exampleQueue);

  // Exchanges
  await rabbitSenderChannel.assertExchange(exampleExchange, "direct"); // direct
  await rabbitReceiverChannel.assertExchange(
    delayedExchange,
    "x-delayed-message",
    { arguments: { "x-delayed-type": "direct" } },
  ); // direct with delay

  // Bindings
  await rabbitSenderChannel.bindQueue(
    exampleQueue,
    exampleExchange,
    routingKey,
  ); // to direct sending
  await rabbitReceiverChannel.bindQueue(
    exampleQueue,
    delayedExchange,
    routingKey,
  ); // to repeated sending with delay

  const handler = (message) => {
    if (message === "Right message") {
      console.log("Right message was received");
    } else {
      throw new Error("Test error", message?.content);
    }
  };

  // Consumer
  await rabbitReceiverChannel.consume(exampleQueue, async (msg) => {
    try {
      handler(msg.content.toString());

      rabbitReceiverChannel.ack(msg);
    } catch (err) {
      const attempts =
        parseInt(msg.properties?.headers["x-republish-attempts"], 10) || 0;

      if (attempts > 3) {
        rabbitReceiverChannel.ack(msg);

        console.log(
          "ERROR: Maximum number of attemps reached, message was droped",
        );
      } else {
        console.log(
          `ERROR: Something went wrong. Received message was republish with ${delayTimeout} ms delay, ${attempts} attempt`,
        );

        rabbitReceiverChannel.publish(
          delayedExchange,
          msg.fields.routingKey,
          msg.content,
          {
            headers: {
              ...msg.properties.headers,
              "x-republish-attempts": attempts + 1, // save number of attepts
              "x-delay": delayTimeout,
            },
          },
        );

        rabbitReceiverChannel.ack(msg);
      }
    }
  });

  setTimeout(() => {
    rabbitSenderChannel.publish(
      exampleExchange,
      "test",
      Buffer.from("Right message"),
    );
  }, 1000);

  setTimeout(() => {
    rabbitSenderChannel.publish(
      exampleExchange,
      routingKey,
      Buffer.from("Wrong message"),
    );
  }, 2000);
}

module.exports = {
  run,
};
