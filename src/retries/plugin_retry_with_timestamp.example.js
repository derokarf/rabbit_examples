const amqplib = require("amqplib");

// Retrying with installed delay plugin and control proccess with timestamp of messages

async function run() {
  const exampleQueue = "test-queue";
  const exampleExchange = "test-exchange";
  const delayedExchange = "delayed-exchange";
  const routingKey = "test";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms
  const TTL = 13000;

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

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
      const timestamp = parseInt(msg.properties?.timestamp, 10) || 0;

      const actualTime = Date.now();

      if (actualTime - timestamp > TTL) {
        rabbitReceiverChannel.ack(msg);

        console.log("ERROR: Maximum TTL reached, message was droped");
      } else {
        console.log(
          `ERROR: Something went wrong. Received message was republish with ${delayTimeout} ms delay, ${
            TTL - (actualTime - timestamp)
          } ms left`,
        );

        rabbitReceiverChannel.publish(
          delayedExchange,
          msg.fields.routingKey,
          msg.content,
          {
            timestamp: msg.properties.timestamp,
            headers: {
              ...msg.properties.headers,
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
      {
        timestamp: Date.now(), // set timestamp of message
      },
    );
  }, 1000);

  setTimeout(() => {
    rabbitSenderChannel.publish(
      exampleExchange,
      routingKey,
      Buffer.from("Wrong message"),
      {
        timestamp: Date.now(), // set timestamp of message
      },
    );
  }, 2000);
}

module.exports = {
  run,
};
