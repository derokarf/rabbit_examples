const amqplib = require("amqplib");

console.log(
  "EXAMPLE 3: Retrying with dead-letter and control proccess with number of attemts and ampq rejecting",
);

async function run() {
  const exampleQueue = "test-queue";
  const delayedQueue = "delayed-queue";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  await Promise.all([
    rabbitReceiverChannel.deleteQueue(exampleQueue),
    rabbitReceiverChannel.deleteQueue(delayedQueue),
  ]);

  // Queues
  await Promise.all([
    rabbitReceiverChannel.assertQueue(exampleQueue, {
      deadLetterExchange: "",
      deadLetterRoutingKey: delayedQueue,
    }),
    rabbitReceiverChannel.assertQueue(delayedQueue, {
      deadLetterExchange: "",
      deadLetterRoutingKey: exampleQueue,
      messageTtl: delayTimeout,
    }),
  ]);

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
      const deaths = msg.properties.headers["x-death"];

      const delayedAttempt = deaths?.find(
        (death) => death.queue === delayedQueue,
      );

      const attempts = delayedAttempt?.count || 0;

      if (attempts > 3) {
        rabbitReceiverChannel.ack(msg);

        console.log(
          "ERROR: Maximum number of attemps reached, message was droped",
        );
      } else {
        console.log(
          `ERROR: Something went wrong. Received message was republish with ${delayTimeout} ms delay, ${attempts} attempt`,
        );

        rabbitReceiverChannel.reject(msg, false);
      }
    }
  });

  setTimeout(() => {
    rabbitSenderChannel.publish("", exampleQueue, Buffer.from("Right message"));
  }, 1000);

  setTimeout(() => {
    rabbitSenderChannel.publish("", exampleQueue, Buffer.from("Wrong message"));
  }, 2000);
}

module.exports = {
  run,
};
