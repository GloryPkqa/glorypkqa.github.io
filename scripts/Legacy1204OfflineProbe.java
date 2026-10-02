package legacy1204audit;
import com.google.gson.*;
import com.mojang.brigadier.*;
import com.mojang.serialization.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Offline parser/codec inspection only. Never create a MinecraftServer, world,
// network listener or execute any parsed command.
public class Legacy1204OfflineProbe {
  static final Map<String,String> classes=new HashMap<>();
  static final Map<String,List<String>> members=new HashMap<>();
  static Class<?> type(String name) throws Exception {
    return switch(name) {case "int"->int.class;case "boolean"->boolean.class;default->Class.forName(classes.getOrDefault(name,name));};
  }
  static Method method(String owner,String name,String...params) throws Exception {
    String signature=name+"("+String.join(",",params)+")";
    String line=members.get(owner).stream().filter(s->s.contains(" "+signature+" -> ")).findFirst().orElseThrow(()->new IllegalArgumentException(owner+"."+signature));
    Class<?>[] types=new Class<?>[params.length];for(int i=0;i<params.length;i++)types[i]=type(params[i]);
    Method method=type(owner).getDeclaredMethod(line.substring(line.lastIndexOf(" -> ")+4),types);method.setAccessible(true);return method;
  }
  static Object call(String owner,String name,Object instance,String[] params,Object...args) throws Exception {return method(owner,name,params).invoke(instance,args);}
  static Object field(String owner,String name) throws Exception {
    String line=members.get(owner).stream().filter(s->s.endsWith(" "+name+" -> "+s.substring(s.lastIndexOf(" -> ")+4))).findFirst().orElseThrow();
    Field field=type(owner).getDeclaredField(line.substring(line.lastIndexOf(" -> ")+4));field.setAccessible(true);return field.get(null);
  }
  static Object create(String owner,String[] params,Object...args) throws Exception {
    Class<?>[] types=new Class<?>[params.length];for(int i=0;i<params.length;i++)types[i]=type(params[i]);
    Constructor<?> constructor=type(owner).getDeclaredConstructor(types);constructor.setAccessible(true);return constructor.newInstance(args);
  }
  static Throwable cause(Throwable error){while(error instanceof InvocationTargetException && error.getCause()!=null)error=error.getCause();return error;}
  static final String[] NONE=new String[0];
  static void require(boolean value,String message) {if(!value)throw new IllegalArgumentException(message);}

  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    String owner="";
    for(String line:Files.readAllLines(Path.of(args[0]))) {
      if(!line.startsWith(" ") && line.contains(" -> ") && line.endsWith(":")) {owner=line.substring(0,line.indexOf(" -> "));classes.put(owner,line.substring(line.indexOf(" -> ")+4,line.length()-1));members.put(owner,new ArrayList<>());}
      else if(line.startsWith("    ") && !owner.isEmpty())members.get(owner).add(line.trim());
    }
    call("net.minecraft.SharedConstants","tryDetectVersion",null,NONE);
    call("net.minecraft.server.Bootstrap","bootStrap",null,NONE);
    Object provider=call("net.minecraft.data.registries.VanillaRegistries","createLookup",null,NONE);
    Object context=call("net.minecraft.commands.Commands","createValidationContext",null,new String[]{"net.minecraft.core.HolderLookup$Provider"},provider);
    Object commands=create("net.minecraft.commands.Commands",new String[]{"net.minecraft.commands.Commands$CommandSelection","net.minecraft.commands.CommandBuildContext"},field("net.minecraft.commands.Commands$CommandSelection","ALL"),context);
    CommandDispatcher<Object> dispatcher=(CommandDispatcher<Object>)call("net.minecraft.commands.Commands","getDispatcher",commands,NONE);
    Object source=create("net.minecraft.commands.CommandSourceStack",new String[]{"net.minecraft.commands.CommandSource","net.minecraft.world.phys.Vec3","net.minecraft.world.phys.Vec2","net.minecraft.server.level.ServerLevel","int","java.lang.String","net.minecraft.network.chat.Component","net.minecraft.server.MinecraftServer","net.minecraft.world.entity.Entity"},field("net.minecraft.commands.CommandSource","NULL"),field("net.minecraft.world.phys.Vec3","ZERO"),field("net.minecraft.world.phys.Vec2","ZERO"),null,4,"offline-probe",call("net.minecraft.network.chat.Component","literal",null,new String[]{"java.lang.String"},"offline-probe"),null,null);
    JsonArray failures=new JsonArray(),rows=new JsonArray();Map<String,Integer> counts=new LinkedHashMap<>();
    for(JsonElement entry:JsonParser.parseString(Files.readString(Path.of(args[1]))).getAsJsonArray()) {
      JsonObject row=entry.getAsJsonObject(),observed=new JsonObject();String kind=row.get("kind").getAsString();String id=row.get("id").getAsString();boolean reject=row.has("reject")&&row.get("reject").getAsBoolean();counts.merge(kind,1,Integer::sum);
      Throwable error=null;
      try {
        switch(kind) {
          case "command", "potion", "give-name", "item-nbt", "banner", "item-entity": {
            String command=row.get("value").getAsString().replaceFirst("^/","");
            ParseResults<Object> parsed=dispatcher.parse(command,source);
            call("net.minecraft.commands.Commands","validateParseResults",null,new String[]{"com.mojang.brigadier.ParseResults"},parsed);
            require(parsed.getContext().getLastChild().getCommand()!=null,"No executable command");
            if(kind.equals("item-entity")) {
              Object entityNbt=parsed.getContext().getLastChild().getArguments().get("nbt").getResult();
              Object stackNbt=call("net.minecraft.nbt.CompoundTag","getCompound",entityNbt,new String[]{"java.lang.String"},"Item");
              Object stack=call("net.minecraft.world.item.ItemStack","of",null,new String[]{"net.minecraft.nbt.CompoundTag"},stackNbt);
              require(!(boolean)call("net.minecraft.world.item.ItemStack","isEmpty",stack,NONE),"Summoned item stack is empty");
              observed.addProperty("count",(int)call("net.minecraft.world.item.ItemStack","getCount",stack,NONE));
            } else if(!kind.equals("command")) {
              Object item=parsed.getContext().getLastChild().getArguments().get("item").getResult();
              Object stack=call("net.minecraft.commands.arguments.item.ItemInput","createItemStack",item,new String[]{"int","boolean"},1,false);
              Object nbt=call("net.minecraft.world.item.ItemStack","getTag",stack,NONE);
              observed.addProperty("tag",String.valueOf(nbt));
              if(kind.equals("give-name")) {
                Object component=call("net.minecraft.world.item.ItemStack","getHoverName",stack,NONE);
                String name=(String)type("net.minecraft.network.chat.Component").getMethod("getString").invoke(component);
                observed.addProperty("name",name);require(name.equals(row.get("name").getAsString()),"Custom name differs: "+name);
              }
              if(kind.equals("potion")) {
                List<?> effects=(List<?>)call("net.minecraft.world.item.alchemy.PotionUtils","getCustomEffects",null,new String[]{"net.minecraft.world.item.ItemStack"},stack);
                observed.addProperty("effects",effects.size());require(effects.size()==row.get("effects").getAsJsonArray().size(),"Potion effects were dropped");
                JsonArray effectsFound=new JsonArray();observed.add("effectData",effectsFound);
                for(int i=0;i<effects.size();i++) {
                  Object effect=effects.get(i);int duration=(int)call("net.minecraft.world.effect.MobEffectInstance","getDuration",effect,NONE);int amplifier=(int)call("net.minecraft.world.effect.MobEffectInstance","getAmplifier",effect,NONE);
                  String description=(String)call("net.minecraft.world.effect.MobEffectInstance","getDescriptionId",effect,NONE);
                  boolean visible=(boolean)call("net.minecraft.world.effect.MobEffectInstance","isVisible",effect,NONE);
                  JsonObject e=new JsonObject();e.addProperty("duration",duration);e.addProperty("amplifier",amplifier);e.addProperty("description",description);e.addProperty("visible",visible);effectsFound.add(e);
                  JsonObject expected=row.get("effects").getAsJsonArray().get(i).getAsJsonObject();require(duration==expected.get("duration").getAsInt() && amplifier==expected.get("amplifier").getAsInt(),"Potion duration/amplifier differs");
                  require(description.equals("effect.minecraft."+expected.get("name").getAsString()),"Potion effect identity differs");require(visible==expected.get("visible").getAsBoolean(),"Potion particles differ");
                }
                observed.add("effectData",effectsFound);
              }
              if(kind.equals("banner")) {
                Object patterns=call("net.minecraft.world.level.block.entity.BannerBlockEntity","getItemPatterns",null,new String[]{"net.minecraft.world.item.ItemStack"},stack);
                Object color=call("net.minecraft.world.item.DyeColor","byId",null,new String[]{"int"},row.get("base").getAsInt());
                List<?> resolved=(List<?>)call("net.minecraft.world.level.block.entity.BannerBlockEntity","createPatterns",null,new String[]{"net.minecraft.world.item.DyeColor","net.minecraft.nbt.ListTag"},color,patterns);
                observed.addProperty("recognizedPatterns",resolved.size()-1);require(resolved.size()-1==row.get("patterns").getAsInt(),"Banner patterns were dropped");
                if(row.get("shield").getAsBoolean()) {
                  Object blockNbt=call("net.minecraft.world.item.ItemStack","getTagElement",stack,new String[]{"java.lang.String"},"BlockEntityTag");
                  int base=(int)call("net.minecraft.nbt.CompoundTag","getInt",blockNbt,new String[]{"java.lang.String"},"Base");require(base==row.get("base").getAsInt(),"Shield base color differs");
                }
              }
            }
            break;
          }
          case "nbt": call("net.minecraft.nbt.TagParser","parseTag",null,new String[]{"java.lang.String"},row.get("value").getAsString());break;
          case "text": call("net.minecraft.network.chat.Component$Serializer","fromJson",null,new String[]{"java.lang.String"},row.get("value").getAsString());break;
          case "recipe": {
            Object resource=create("net.minecraft.resources.ResourceLocation",new String[]{"java.lang.String"},"pkqa:offline_probe");
            call("net.minecraft.world.item.crafting.RecipeManager","fromJson",null,new String[]{"net.minecraft.resources.ResourceLocation","com.google.gson.JsonObject"},resource,row.get("value").getAsJsonObject());break;
          }
          case "loot": {
            Codec<?> codec=(Codec<?>)field("net.minecraft.world.level.storage.loot.LootTable","CODEC");
            DataResult<?> result=codec.parse(JsonOps.INSTANCE,row.get("value"));
            require(result.result().isPresent(),"Loot codec: "+result.error());break;
          }
          default: throw new IllegalArgumentException("Unsupported kind "+kind);
        }
      } catch(Throwable caught){error=cause(caught);}
      JsonObject output=new JsonObject();output.addProperty("id",id);output.addProperty("kind",kind);output.addProperty("accepted",error==null);output.add("observed",observed);if(error!=null)output.addProperty("error",error.toString());rows.add(output);
      if((error==null)==reject){JsonObject failure=output.deepCopy();failure.add("value",row.get("value"));failures.add(failure);}
    }
    JsonObject result=new JsonObject();result.addProperty("version","1.20.4");result.add("counts",new Gson().toJsonTree(counts));result.add("failures",failures);result.add("rows",rows);
    Files.writeString(Path.of(args[2]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
    System.out.println("LEGACY OFFLINE AUDIT "+counts+" failures="+failures.size());
  }
}
