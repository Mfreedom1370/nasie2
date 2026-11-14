package ir.nasie.offline;
import android.content.Context;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.json.JSONObject;
import java.io.File;
import java.nio.file.Files;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=28,manifest=Config.NONE)
public class BackupEngineTest {
 private Context context;private File job,ledger;private String original;
 @Before public void setup()throws Exception {
  context=RuntimeEnvironment.getApplication();BackupEngine.prefs(context).edit().clear().commit();
  JSONObject set=new JSONObject().put("autoBackup",true).put("backupTelegram",true).put("backupDrive",true);
  String raw=new JSONObject().put("schema",2).put("customers",new org.json.JSONArray()).put("tx",new org.json.JSONArray()).put("set",set).toString();
  ledger=new File(context.getFilesDir(),"ledger-state.json");BackupEngine.write(ledger,new JSONObject().put("nasie",raw));original=new String(Files.readAllBytes(ledger.toPath()),java.nio.charset.StandardCharsets.UTF_8);
  job=new File(BackupEngine.dir(context),"fixture.json.job");BackupEngine.write(job,new JSONObject().put("name","fixture.json").put("hash",BackupEngine.hash(raw)).put("raw",raw).put("telegram",true).put("drive",true));
 }
 @Test public void partialSuccessSurvivesRetryWithoutResendingSuccessfulDestination()throws Exception {
  final int[] calls={0,0};BackupSender.Delivery partial=new BackupSender.Delivery(){public void telegram(JSONObject j,JSONObject s){calls[0]++;}public void drive(Context c,JSONObject j)throws Exception{calls[1]++;throw new Exception("offline");}};
  assertTrue(BackupSender.runPending(context,partial,()->false));assertTrue(job.exists());JSONObject saved=BackupEngine.read(job);assertTrue(saved.getBoolean("telegramDone"));assertFalse(saved.optBoolean("driveDone"));
  assertFalse(BackupSender.runPending(context,new BackupSender.Delivery(){public void telegram(JSONObject j,JSONObject s){calls[0]++;}public void drive(Context c,JSONObject j){calls[1]++;}},()->false));
  assertEquals(1,calls[0]);assertEquals(2,calls[1]);assertFalse(job.exists());assertEquals(original,new String(Files.readAllBytes(ledger.toPath()),java.nio.charset.StandardCharsets.UTF_8));
 }
 @Test public void bothFailuresKeepExactSnapshotAndNeverAcknowledgeSuccess()throws Exception {
  String before=BackupEngine.read(job).toString();BackupSender.Delivery unavailable=new BackupSender.Delivery(){public void telegram(JSONObject j,JSONObject s)throws Exception{throw new Exception("offline");}public void drive(Context c,JSONObject j)throws Exception{throw new Exception("offline");}};
  assertTrue(BackupSender.runPending(context,unavailable,()->false));assertEquals(before,BackupEngine.read(job).toString());assertFalse(BackupEngine.read(job).optBoolean("telegramDone"));assertFalse(BackupEngine.read(job).optBoolean("driveDone"));
 }
 @Test public void cancellationAndDisabledConfigurationNeverSend()throws Exception {
  BackupSender.Delivery forbidden=new BackupSender.Delivery(){public void telegram(JSONObject j,JSONObject s){fail("sent while cancelled");}public void drive(Context c,JSONObject j){fail("sent while cancelled");}};
  assertTrue(BackupSender.runPending(context,forbidden,()->true));assertTrue(job.exists());
  JSONObject raw=BackupEngine.ledger(context);raw.getJSONObject("set").put("autoBackup",false);BackupEngine.write(ledger,new JSONObject().put("nasie",raw.toString()));
  assertFalse(BackupSender.runPending(context,forbidden,()->false));assertTrue(job.exists());
 }
 @Test public void invalidLedgerDoesNotReplaceOrDeleteQueuedBackup()throws Exception {
  BackupEngine.write(ledger,new JSONObject().put("nasie","{}"));try{BackupSender.runPending(context,null,()->false);fail("invalid ledger accepted");}catch(Exception expected){assertTrue(job.exists());}
 }
 @Test public void nightlyCutoffKeepsTodayUntilNightAndCatchesUpOlderDays(){
  assertFalse(BackupEngine.due("2026-11-15","2026-11-15",21,22,false));
  assertTrue(BackupEngine.due("2026-11-15","2026-11-15",22,22,false));
  assertTrue(BackupEngine.due("2026-11-14","2026-11-15",1,22,false));
  assertFalse(BackupEngine.due("2026-11-16","2026-11-15",23,22,false));
  assertTrue(BackupEngine.due("2026-11-15","2026-11-15",10,22,true));
 }
 @Test public void corruptSnapshotIsKeptAndNeverUploaded()throws Exception {
  JSONObject damaged=BackupEngine.read(job);damaged.put("raw","corrupt");BackupEngine.write(job,damaged);
  BackupSender.Delivery forbidden=new BackupSender.Delivery(){public void telegram(JSONObject j,JSONObject s){fail("corrupt snapshot sent");}public void drive(Context c,JSONObject j){fail("corrupt snapshot sent");}};
  assertTrue(BackupSender.runPending(context,forbidden,()->false));assertTrue(job.exists());
 }
}
