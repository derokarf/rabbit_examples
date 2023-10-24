const amqplib = require("amqplib");

// Retrying with dead-letter and control proccess with number of attemts

async function run() {
  const exampleQueue = "test-queue";
  const delayedQueue = "delayed-queue";
  const rabbitConnection = await amqplib.connect("amqp://test-rabbitmq", {});
  const delayTimeout = 5000; // ms

  // Channels
  const rabbitSenderChannel = await rabbitConnection.createChannel();
  const rabbitReceiverChannel = await rabbitConnection.createChannel();

  // Queues
  await rabbitReceiverChannel.assertQueue(exampleQueue);
  await rabbitReceiverChannel.assertQueue(delayedQueue, {
    deadLetterExchange: "",
    deadLetterRoutingKey: exampleQueue,
  });

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

        rabbitReceiverChannel.publish("", delayedQueue, msg.content, {
          expiration: delayTimeout,
          headers: {
            "x-republish-attempts": attempts + 1, // save number of attepts
          },
        });

        rabbitReceiverChannel.ack(msg);
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
