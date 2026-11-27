package ir.nasie.offline;
import android.content.Context;
import androidx.work.*;
import org.json.JSONObject;
import java.io.File;
import java.util.Arrays;
public final class BackupSender extends Worker {
 interface Delivery {void telegram(JSONObject job,JSONObject settings)throws Exception;void drive(Context c,JSONObject job)throws Exception;}
 public BackupSender(Context c,WorkerParameters p){super(c,p);}
 @Override public Result doWork(){Context c=getApplicationContext();try{return runPending(c,new Delivery(){
  public void telegram(JSONObject job,JSONObject settings)throws Exception{BackupEngine.telegram(job,settings);}
  public void drive(Context context,JSONObject job)throws Exception{BackupEngine.drive(context,job);}
 },this::isStopped)?Result.retry():Result.success();}catch(Exception e){BackupEngine.status(c,"ارسال متوقف شد؛ نسخه‌های در صف حفظ شدند");return Result.retry();}}
 static boolean runPending(Context c,Delivery delivery,java.util.function.BooleanSupplier stopped)throws Exception {
  boolean retry=false;JSONObject settings=BackupEngine.ledger(c).getJSONObject("set");if(!settings.optBoolean("autoBackup"))return false;
  File[] jobs=BackupEngine.dir(c).listFiles((d,n)->n.endsWith(".job"));if(jobs==null)return false;Arrays.sort(jobs);int count=0;
  for(File file:jobs){if(stopped.getAsBoolean())return true;settings=BackupEngine.ledger(c).getJSONObject("set");if(!settings.optBoolean("autoBackup"))return false;if(++count>3){retry=true;break;}JSONObject job;
   try{job=BackupEngine.read(file);if(!BackupEngine.hash(job.getString("raw")).equals(job.getString("hash")))throw new Exception("snapshot checksum");}
   catch(Exception e){retry=true;BackupEngine.status(c,"یک نسخهٔ صف آسیب دیده؛ حفظ شد و ارسال سایر نسخه‌ها ادامه می‌یابد");continue;}
   String day=job.optString("day");
   if(day.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")){
    try{job.put("name",BackupEngine.nightFileName(day));}catch(java.time.DateTimeException ignored){}
   }
   if(!job.optBoolean("telegram")&&!job.optBoolean("drive")){retry=true;continue;}
   if(job.optBoolean("telegram")&&!job.optBoolean("telegramDone"))try{if(!settings.optBoolean("backupTelegram",true))throw new Exception();String date=job.optString("day");
    boolean daily=date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}");
    android.content.SharedPreferences status=BackupEngine.prefs(c);
    if(!daily||!status.getBoolean("telegramSent_"+date,false)){
     delivery.telegram(job,settings);
     android.content.SharedPreferences.Editor result=status.edit().putString("lastTelegram",BackupEngine.day());
     if(daily)result.putBoolean("telegramSent_"+date,true);
     if(!result.commit())throw new Exception("backup receipt");
    }
    job.put("telegramDone",true);BackupEngine.write(file,job);}catch(Exception e){retry=true;BackupEngine.status(c,"تلگرام ارسال نشد؛ نسخه در صف است. اتصال و توکن را بررسی کن");}
   if(job.optBoolean("drive")&&!job.optBoolean("driveDone"))try{if(!settings.optBoolean("backupDrive",true))throw new Exception();delivery.drive(c,job);job.put("driveDone",true);BackupEngine.write(file,job);BackupEngine.prefs(c).edit().putString("lastDrive",BackupEngine.day()).apply();}catch(Exception e){retry=true;BackupEngine.status(c,"درایو ارسال نشد؛ نسخه در صف است. اتصال و مجوز گوگل را بررسی کن");}
   if((!job.optBoolean("telegram")||job.optBoolean("telegramDone"))&&(!job.optBoolean("drive")||job.optBoolean("driveDone")))new android.util.AtomicFile(file).delete();
  }
  if(!retry)BackupEngine.status(c,"تمام نسخه‌های آماده به مقصدهای فعال ارسال شدند");return retry;
 }
}
