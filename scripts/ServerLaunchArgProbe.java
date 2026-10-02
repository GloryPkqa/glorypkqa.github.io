import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.List;

/** Tiny offline fixture. It never loads Minecraft, opens a socket, or changes
 * server configuration. Its only side effect is a line of stdout and exit 7.
 */
public final class ServerLaunchArgProbe {
    private static String json(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\\' || c == '"') out.append('\\').append(c);
            else if (c < 32 || c >= 127) out.append(String.format("\\u%04x", (int) c));
            else out.append(c);
        }
        return out.append('"').toString();
    }
    private static String jsonList(String[] values) {
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) out.append(',');
            out.append(json(values[i]));
        }
        return out.append(']').toString();
    }
    public static void main(String[] args) throws Exception {
        List<String> vm = ManagementFactory.getRuntimeMXBean().getInputArguments();
        String jar = new File(ServerLaunchArgProbe.class.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();
        String cwd = new File(".").getCanonicalPath();
        System.out.println("MC_LAUNCH_PROBE={\"arguments\":" + jsonList(args)
            + ",\"jvmArguments\":" + jsonList(vm.toArray(new String[0]))
            + ",\"jar\":" + json(jar) + ",\"cwd\":" + json(cwd)
            + ",\"javaVersion\":" + json(System.getProperty("java.version"))
            + ",\"exitCode\":7}");
        System.exit(7);
    }
}
