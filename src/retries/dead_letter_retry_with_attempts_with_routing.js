const amqplib = require("amqplib");

// Retrying with dead-letter and control proccess with number of attemts and routing

async function run() {
  const exampleQueue = "test-queue";
  const delayedQueue = "delayed-queue"; // queue without consumers
  const delayedExchange = "delayed-exchange";
  const exampleExchange = "example-exchange";
  const exampleRoutingKey = "example-routing-key";
  const delayedRoutingKey = "delayed-routing-key";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  // Queues
  await rabbitReceiverChannel.assertQueue(exampleQueue);
  await rabbitReceiverChannel.assertQueue(delayedQueue, {
    deadLetterExchange: delayedExchange,
    deadLetterRoutingKey: delayedRoutingKey, // set the queue to send a message after expiration
  });

  // Exchanges
  await rabbitReceiverChannel.assertExchange(exampleExchange, "direct");
  await rabbitReceiverChannel.assertExchange(delayedExchange, "direct");

  // Bindings
  await rabbitReceiverChannel.bindQueue(
    exampleQueue,
    exampleExchange,
    exampleRoutingKey,
  );

  await rabbitReceiverChannel.bindQueue(
    exampleQueue,
    delayedExchange,
    exampleRoutingKey,
  );

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
        const newAttemps = attempts + 1;

        console.log(
          `ERROR: Something went wrong. Received message was republish with ${
            delayTimeout * newAttemps
          } ms delay, ${attempts} attempt`,
        );

        rabbitReceiverChannel.publish("", delayedQueue, msg.content, {
          expiration: delayTimeout * newAttemps,
          headers: {
            "x-republish-attempts": newAttemps, // save number of attepts
            "x-dead-letter-routing-key": msg.fields.routingKey,
          },
        });

        rabbitReceiverChannel.ack(msg);
      }
    }
  });

  setTimeout(() => {
    rabbitSenderChannel.publish(
      exampleExchange,
      exampleRoutingKey,
      Buffer.from("Right message"),
    );
  }, 1000);

  setTimeout(() => {
    rabbitSenderChannel.publish(
      exampleExchange,
      exampleRoutingKey,
      Buffer.from("Wrong message"),
    );
  }, 2000);
}

module.exports = {
  run,
};
