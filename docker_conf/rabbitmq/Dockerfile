FROM rabbitmq:3-management-alpine

RUN apk --no-cache add wget

RUN wget https://github.com/rabbitmq/rabbitmq-delayed-message-exchange/releases/download/v3.12.0/rabbitmq_delayed_message_exchange-3.12.0.ez
RUN mv rabbitmq_delayed_message_exchange-3.12.0.ez plugins/

RUN rabbitmq-plugins enable rabbitmq_delayed_message_exchange