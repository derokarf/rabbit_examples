const amqplib = require("amqplib");

async function initQueues() {
  const exampleQueue = "test-queue";
  const exampleExchange = "test-exchange";
  const delayExchange = "delay-exchange";
  const routingKey = "test";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  // Queue
  await rabbitReceiverChannel.assertQueue(exampleQueue);

  // Exchanges
  await rabbitSenderChannel.assertExchange(exampleExchange, "direct"); // direct
  await rabbitReceiverChannel.assertExchange(
    delayExchange,
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
    delayExchange,
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
    console.log(msg);
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
          delayExchange,
          msg.fields.routingKey,
          msg.content,
          {
            headers: {
              ...msg.properties.headers,
              "x-republish-attempts": attempts + 1,
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
  initQueues,
};
