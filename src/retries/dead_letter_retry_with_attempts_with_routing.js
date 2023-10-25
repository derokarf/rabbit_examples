const amqplib = require("amqplib");

console.log(
  "EXAMPLE 4: Retrying with dead-letter and control proccess with number of attemts and routing",
);

async function run() {
  const exampleQueue = "test-queue";
  const delayedQueue = "delayed-queue"; // queue without consumers
  const delayedExchange = "delayed-exchange";
  const exampleExchange = "example-exchange";
  const replayExchange = "replay-exchange";
  const exampleRoutingKey = "example-routing-key";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  await Promise.all([
    rabbitReceiverChannel.deleteQueue(exampleQueue),
    rabbitReceiverChannel.deleteQueue(delayedQueue),
    rabbitReceiverChannel.deleteExchange(delayedExchange),
    rabbitReceiverChannel.deleteExchange(exampleExchange),
    rabbitReceiverChannel.deleteExchange(replayExchange),
  ]);

  // Queues
  await rabbitReceiverChannel.assertQueue(exampleQueue);
  await rabbitReceiverChannel.assertQueue(delayedQueue, {
    deadLetterExchange: replayExchange,
  });

  // Exchanges
  await rabbitReceiverChannel.assertExchange(exampleExchange, "direct");
  await rabbitReceiverChannel.assertExchange(delayedExchange, "direct");
  await rabbitReceiverChannel.assertExchange(replayExchange, "direct");

  // Bindings
  await rabbitReceiverChannel.bindQueue(
    exampleQueue,
    exampleExchange,
    exampleRoutingKey,
  );

  await rabbitReceiverChannel.bindQueue(
    delayedQueue,
    delayedExchange,
    exampleRoutingKey,
  );

  await rabbitReceiverChannel.bindQueue(
    exampleQueue,
    replayExchange,
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

        rabbitReceiverChannel.publish(
          delayedExchange,
          exampleRoutingKey,
          msg.content,
          {
            expiration: delayTimeout * newAttemps,
            headers: {
              "x-republish-attempts": newAttemps, // save number of attepts
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
