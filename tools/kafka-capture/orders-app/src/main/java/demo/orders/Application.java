package demo.orders;

import io.micronaut.context.ApplicationContext;
import io.micronaut.runtime.Micronaut;

public class Application {

    public static void main(String[] args) {
        if ("producer".equals(System.getenv("APP_MODE"))) {
            // producer mode: start, send, close — an ordinary program
            try (ApplicationContext context = ApplicationContext.run()) {
                context.getBean(SendOrders.class).send();
            }
        } else {
            // consumer mode: keep running; the @KafkaListener polls until the app is stopped
            Micronaut.run(Application.class, args);
        }
    }
}
