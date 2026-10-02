import com.google.gson.*;
import com.mojang.brigadier.*;
import com.mojang.serialization.*;
import net.minecraft.SharedConstants;
import net.minecraft.server.Bootstrap;
import net.minecraft.data.registries.VanillaRegistries;
import net.minecraft.commands.Commands;
import net.minecraft.server.permissions.PermissionSet;
import net.minecraft.core.HolderLookup;
import net.minecraft.network.chat.ComponentSerialization;
import net.minecraft.nbt.TagParser;
import net.minecraft.nbt.NbtOps;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.level.storage.loot.LootTable;
import net.minecraft.server.packs.metadata.pack.PackMetadataSection;
import java.nio.file.*;
import java.util.*;
public class NativeMcAudit {
 public static void main(String[] args) throws Exception {
  SharedConstants.tryDetectVersion(); Bootstrap.bootStrap();
  HolderLookup.Provider provider=VanillaRegistries.createLookup();
  net.minecraft.core.registries.BuiltInRegistries.DATA_COMPONENT_INITIALIZERS.build(provider).forEach(init -> init.apply());
  var jsonOps=provider.createSerializationContext(JsonOps.INSTANCE);
  var nbtOps=provider.createSerializationContext(NbtOps.INSTANCE);
  var commands=new Commands(Commands.CommandSelection.ALL,Commands.createValidationContext(provider));
  var source=Commands.createCompilationContext(PermissionSet.ALL_PERMISSIONS);
  JsonArray cases=JsonParser.parseString(Files.readString(Path.of(args[0]))).getAsJsonArray();
  JsonArray failures=new JsonArray(); Map<String,Integer> totals=new LinkedHashMap<>();
  for(JsonElement raw:cases){JsonObject row=raw.getAsJsonObject();String kind=row.get("kind").getAsString();String id=row.get("id").getAsString();
   totals.merge(kind,1,Integer::sum);
   try{
    switch(kind){
     case "command": {
      String command=row.get("value").getAsString().replaceFirst("^/","");
      var parsed=commands.getDispatcher().parse(command,source); Commands.validateParseResults(parsed);
      if(parsed.getContext().getLastChild().getCommand()==null) throw new Exception("No executable command after parse"); break;
     }
     case "text": ComponentSerialization.CODEC.parse(nbtOps,TagParser.create(NbtOps.INSTANCE).parseFully(row.get("value").getAsString())).getOrThrow(); break;
     case "recipe": Recipe.CODEC.parse(jsonOps,row.get("value")).getOrThrow(); break;
     case "item": net.minecraft.world.item.ItemStack.CODEC.parse(jsonOps,row.get("value")).getOrThrow(); break;
     case "loot": LootTable.DIRECT_CODEC.parse(jsonOps,row.get("value")).getOrThrow(); break;
     case "pack": PackMetadataSection.SERVER_TYPE.codec().parse(jsonOps,row.get("value")).getOrThrow(); break;
     case "entity": if(!net.minecraft.core.registries.BuiltInRegistries.ENTITY_TYPE.getValue(net.minecraft.resources.Identifier.parse(row.get("value").getAsString())).canSummon()) throw new Exception("Entity cannot be summoned"); break;
     case "position": {var p=row.get("value").getAsJsonArray();if(!net.minecraft.world.level.Level.isInSpawnableBounds(new net.minecraft.core.BlockPos(p.get(0).getAsInt(),p.get(1).getAsInt(),p.get(2).getAsInt())))throw new Exception("Outside game spawnable bounds"); break;}
     default: throw new Exception("Unknown kind "+kind);
    }
    if(row.has("reject") && row.get("reject").getAsBoolean()) throw new AssertionError("Expected official parser to reject this control");
   }catch(Throwable error){if(row.has("reject") && row.get("reject").getAsBoolean() && !(error instanceof AssertionError)) continue; JsonObject failure=new JsonObject();failure.addProperty("kind",kind);failure.addProperty("id",id);failure.addProperty("error",error.toString());failure.add("value",row.get("value"));failures.add(failure);}
  }
  JsonObject result=new JsonObject();result.add("counts",new Gson().toJsonTree(totals));result.add("failures",failures);
  Files.writeString(Path.of(args[1]),new GsonBuilder().setPrettyPrinting().create().toJson(result));
  System.out.println("NATIVE AUDIT "+totals+" failures="+failures.size());
 }
}
