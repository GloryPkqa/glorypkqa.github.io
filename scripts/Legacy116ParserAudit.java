import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import com.google.gson.*;
import com.mojang.brigadier.*;

/** Only initializes built-in registries and parses; never executes a command or server main. */
public final class Legacy116ParserAudit {
  static Throwable cause(Throwable e) {
    while (e instanceof InvocationTargetException && e.getCause()!=null) e=e.getCause();
    return e;
  }
  public static void main(String[] args) throws Exception {
    Gson gson = new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create();
    Class.forName("w").getMethod("a").invoke(null);
    Class.forName("vm").getMethod("a").invoke(null);
    Class<?> commandsClass=Class.forName("dc"), selectionClass=Class.forName("dc$a");
    Object commands=commandsClass.getConstructor(selectionClass).newInstance(selectionClass.getField("a").get(null));
    @SuppressWarnings("unchecked") CommandDispatcher<Object> dispatcher=(CommandDispatcher<Object>)commandsClass.getMethod("a").invoke(commands);
    Constructor<?> sourceConstructor=Arrays.stream(Class.forName("db").getConstructors()).filter(c->c.getParameterCount()==9).findFirst().orElseThrow();
    Object source=sourceConstructor.newInstance(
      Class.forName("da").getField("a_").get(null),Class.forName("dcn").getField("a").get(null),
      Class.forName("dcm").getField("a").get(null),null,4,"offline-audit",Class.forName("oe").getConstructor(String.class).newInstance("offline-audit"),null,null);
    JsonArray input=new JsonParser().parse(Files.readString(Path.of(args[0]),StandardCharsets.UTF_8)).getAsJsonArray();
    JsonArray rows=new JsonArray();
    for (JsonElement element:input) {
      JsonObject row=new JsonParser().parse(element.toString()).getAsJsonObject();
      String kind=row.get("kind").getAsString(), value=row.get("value").getAsString();
      try {
        if(kind.equals("snbt")) {
          Object nbt=Class.forName("mu").getMethod("a",String.class).invoke(null,value);
          row.addProperty("normalized",nbt.toString());
        } else if(kind.equals("effect") || kind.equals("potion")) {
          Object nbt=Class.forName("mu").getMethod("a",String.class).invoke(null,value);
          Object effect;
          if(kind.equals("potion")) {
            List<?> effects=(List<?>)Class.forName("bnv").getMethod("b",Class.forName("md")).invoke(null,nbt);
            if(effects.size()!=1) throw new IllegalArgumentException("Expected exactly one custom potion effect");
            effect=effects.get(0);
          } else effect=Class.forName("apu").getMethod("b",Class.forName("md")).invoke(null,nbt);
          if(effect==null) throw new IllegalArgumentException("Effect NBT did not deserialize");
          row.addProperty("actualAmplifier",(Integer)Class.forName("apu").getMethod("c").invoke(effect));
          row.addProperty("actualDuration",(Integer)Class.forName("apu").getMethod("b").invoke(effect));
          row.addProperty("visible",(Boolean)Class.forName("apu").getMethod("e").invoke(effect));
          if(kind.equals("effect")) row.addProperty("amplifierNbtType",(Byte)Class.forName("md").getMethod("d",String.class).invoke(nbt,"Amplifier"));
        } else if(kind.equals("command")) {
          if(value.startsWith("/")) value=value.substring(1);
          ParseResults<Object> parsed=dispatcher.parse(value,source);
          Object error=commandsClass.getMethod("a",ParseResults.class).invoke(null,parsed);
          if(error!=null) throw (Throwable)error;
          if(parsed.getContext().getLastChild().getCommand()==null) throw new IllegalArgumentException("No complete executable command in parse tree");
        } else throw new IllegalArgumentException("Unknown kind "+kind);
        row.addProperty("accepted",true);
      } catch(Throwable e) {
        Throwable failure=cause(e);
        row.addProperty("accepted",false);row.addProperty("error",failure.getClass().getName()+": "+failure.getMessage());
      }
      boolean matches=!row.has("expected") || row.get("accepted").getAsBoolean()==row.get("expected").getAsBoolean();
      for(String property:List.of("Amplifier","Duration","Visible")) if(row.has("expected"+property)) {
        String actual=property.equals("Visible")?"visible":"actual"+property;
        matches=matches && row.has(actual) && row.get(actual).equals(row.get("expected"+property));
      }
      row.addProperty("matches",matches);
      rows.add(row);
    }
    JsonObject result=new JsonObject();result.addProperty("minecraft","1.16.5");result.addProperty("javaVersion",System.getProperty("java.version"));
    result.addProperty("mode","Registry initialization and parse only; no command execution, server, worlds, sockets, or EULA");result.add("rows",rows);
    Files.writeString(Path.of(args[1]),gson.toJson(result),StandardCharsets.UTF_8);
  }
}
