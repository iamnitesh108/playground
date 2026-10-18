package demo.tiered;

import io.micronaut.context.ApplicationContext;

public class Application {
    public static void main(String[] args) throws Exception {
        try (ApplicationContext context = ApplicationContext.run()) {
            context.getBean(Shell.class).run();
        }
    }
}
