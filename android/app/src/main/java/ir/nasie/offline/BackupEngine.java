package ir.nasie.offline;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.AtomicFile;
import androidx.work.*;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Tasks;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Separate durable outbox: workers never write or restore accounting data. */
final class BackupEngine {
 static final Object LOCK=new Object(), LEDGER_LOCK=new Object();
 static final String DRIVE_SCOPE="https://www.googleapis.com/auth/drive.file";
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("cloud-backup",Context.MODE_PRIVATE);}
 static String day(){return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());}
 static File dir(Context c){File d=new File(c.getFilesDir(),"backup-outbox");if(!d.isDirectory()&&!d.mkdirs())throw new IllegalStateException("backup storage");return d;}
 static JSONObject read(File f)throws Exception{synchronized(LOCK){return new JSONObject(new String(new AtomicFile(f).readFully(),StandardCharsets.UTF_8));}}
 static void write(File f,JSONObject data)throws Exception {synchronized(LOCK){
  AtomicFile file=new AtomicFile(f);FileOutputStream out=null;
  try{byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!java.util.Arrays.equals(bytes,file.readFully()))throw new IOException("backup write verification failed");}
  catch(Exception e){if(out!=null)file.failWrite(out);throw e;}
 }}
 static JSONObject ledger(Context c)throws Exception {
  synchronized(LEDGER_LOCK){AtomicFile file=new AtomicFile(new File(c.getFilesDir(),"ledger-state.json"));
   String raw=new JSONObject(new String(file.readFully(),StandardCharsets.UTF_8)).getString("nasie");JSONObject data=new JSONObject(raw);
   if(data.getInt("schema")!=2||data.optJSONArray("customers")==null||data.optJSONArray("tx")==null||data.optJSONObject("set")==null)throw new IOException("invalid ledger");return data;}
 }
 static String hash(String raw)throws Exception {byte[] bytes=MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.US,"%02x",b&255));return out.toString();}
 static void status(Context c,String message){prefs(c).edit().putString("status",message).apply();}
 static final int NIGHT_HOUR=22;
 static final String CLOCK_WORK="nasie-nightly-backup";
 static long delayToNight(Calendar now){
  Calendar next=(Calendar)now.clone();
  next.set(Calendar.HOUR_OF_DAY,NIGHT_HOUR);
  next.set(Calendar.MINUTE,0);
  next.set(Calendar.SECOND,0);
  next.set(Calendar.MILLISECOND,0);
  if(next.before(now))next.add(Calendar.DATE,1);
  return next.getTimeInMillis()-now.getTimeInMillis();
 }
 static void schedule(Context c){
  WorkManager wm=WorkManager.getInstance(c);
  wm.cancelUniqueWork("nasie-backup-clock");
  wm.enqueueUniquePeriodicWork(CLOCK_WORK,ExistingPeriodicWorkPolicy.KEEP,
   new PeriodicWorkRequest.Builder(BackupClock.class,24,TimeUnit.HOURS)
    .setInitialDelay(delayToNight(Calendar.getInstance()),TimeUnit.MILLISECONDS).build());
 }
 static void cancelSchedule(Context c){
  WorkManager wm=WorkManager.getInstance(c);
  wm.cancelUniqueWork("nasie-backup-clock");
  wm.cancelUniqueWork(CLOCK_WORK);
 }
 static String stageDay(String snapshotDay,String queuedThrough){
  if(snapshotDay.compareTo(queuedThrough)>0)return snapshotDay;
  return java.time.LocalDate.parse(queuedThrough).plusDays(1).toString();
 }
 static void sendSoon(Context c){WorkManager.getInstance(c).enqueueUniqueWork("nasie-backup-send",ExistingWorkPolicy.KEEP,
  new OneTimeWorkRequest.Builder(BackupSender.class).setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build());}
 static void record(Context c,String raw){long modified=new File(c.getFilesDir(),"ledger-state.json").lastModified();record(c,raw,new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date(modified>0?modified:System.currentTimeMillis())));}
 static void record(Context c,String raw,String snapshotDay){
  try{JSONObject data=new JSONObject(raw),s=data.getJSONObject("set");
   if(!s.optBoolean("autoBackup")){cancelSchedule(c);return;}
   synchronized(LOCK){String fingerprint=hash(raw);if(!fingerprint.equals(prefs(c).getString("recorded",""))){
    String backupDay=stageDay(snapshotDay,prefs(c).getString("queuedThrough",""));
    write(new File(dir(c),backupDay+".stage"),new JSONObject().put("raw",raw).put("hash",fingerprint).put("day",backupDay));
    if(!prefs(c).edit().putString("recorded",fingerprint).commit())throw new IOException("backup metadata");
   }}schedule(c);prepare(c);sendSoon(c);
  }catch(Exception e){status(c,"آماده‌سازی بکاپ انجام نشد؛ حافظه و تنظیمات را بررسی کن");}
 }
 static boolean due(String snapshotDay,String today,int hour){
  return snapshotDay.compareTo(today)<0||(snapshotDay.equals(today)&&hour>=NIGHT_HOUR);
 }
 static void prepare(Context c)throws Exception {
  synchronized(LOCK){JSONObject set=ledger(c).getJSONObject("set");if(!set.optBoolean("autoBackup"))return;
   if(!set.optBoolean("backupTelegram",true)&&!set.optBoolean("backupDrive",true)){status(c,"حداقل یک مقصد بکاپ باید فعال باشد");return;}
   int hour=Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
   File[] files=dir(c).listFiles((d,n)->n.endsWith(".stage"));if(files==null)return;
   Arrays.sort(files);
   SharedPreferences preferences=prefs(c);
   boolean queued=false;
   for(File file:files){
    JSONObject stage=read(file);
    String date=stage.getString("day");
    if(!due(date,day(),hour))continue;
    if(date.compareTo(preferences.getString("queuedThrough",""))>0){
     String name="nasie-"+date+".json";
     File job=new File(dir(c),name+".job");
     if(!job.exists())write(job,stage.put("name",name).put("telegram",set.optBoolean("backupTelegram",true)).put("drive",set.optBoolean("backupDrive",true)).put("telegramDone",false).put("driveDone",false));
     if(!preferences.edit().putString("queuedThrough",date).commit())throw new IOException("backup metadata");
     queued=true;
    }
    new AtomicFile(file).delete();
   }
   if(queued)status(c,"بکاپ شبانه آماده شد؛ اگر اینترنت قطع باشد در صف می‌ماند");
  }
 }
 static String summary(Context c){try{int count=0;File[] jobs=dir(c).listFiles((d,n)->n.endsWith(".job"));if(jobs!=null)count=jobs.length;
  return new JSONObject().put("pending",count).put("status",prefs(c).getString("status","بکاپ خودکار هنوز فعال نشده"))
   .put("telegram",prefs(c).getString("lastTelegram","—")).put("drive",prefs(c).getString("lastDrive","—")).toString();
 }catch(Exception e){return "{\"status\":\"وضعیت بکاپ در دسترس نیست\"}";}}
 static AuthorizationRequest driveRequest(){return AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE))).build();}
 static String response(HttpURLConnection connection)throws Exception {
  try{int code=connection.getResponseCode();if(code<200||code>=300)throw new IOException("remote HTTP "+code);
   try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>2_000_000)throw new IOException("response too large");}return out.toString("UTF-8");}
  }finally{connection.disconnect();}
 }
 static HttpURLConnection connection(String url)throws Exception {HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(20000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);return c;}
 static byte[] multipart(String boundary,JSONObject job,boolean drive,JSONObject settings)throws Exception {
  String raw=job.getString("raw"),name=job.getString("name");StringBuilder body=new StringBuilder();
  if(drive)body.append("--").append(boundary).append("\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n").append(new JSONObject().put("name",name).put("appProperties",new JSONObject().put("nasieHash",job.getString("hash")))).append("\r\n");
  else body.append("--").append(boundary).append("\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n").append(settings.getString("chat")).append("\r\n");
  body.append("--").append(boundary).append(drive?"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n":"\r\nContent-Disposition: form-data; name=\"document\"; filename=\""+name+"\"\r\nContent-Type: application/json\r\n\r\n").append(raw).append("\r\n--").append(boundary).append("--\r\n");return body.toString().getBytes(StandardCharsets.UTF_8);
 }
 static void telegram(JSONObject job,JSONObject settings)throws Exception {
  String token=settings.optString("token"),chat=settings.optString("chat");if(!token.matches("[0-9]+:[A-Za-z0-9_-]+")||!chat.matches("-?[0-9]+|@[A-Za-z0-9_]+"))throw new IOException("Telegram settings");
  String boundary="Nasie"+UUID.randomUUID();HttpURLConnection c=connection("https://api.telegram.org/bot"+token+"/sendDocument");c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","multipart/form-data; boundary="+boundary);
  byte[] body=multipart(boundary,job,false,settings);c.setFixedLengthStreamingMode(body.length);try(OutputStream out=c.getOutputStream()){out.write(body);}if(!new JSONObject(response(c)).optBoolean("ok"))throw new IOException("Telegram rejected backup");
 }
 static void drive(Context context,JSONObject job)throws Exception {
  AuthorizationResult auth=Tasks.await(Identity.getAuthorizationClient(context).authorize(driveRequest()),30,TimeUnit.SECONDS);
  if(auth.hasResolution()||auth.getAccessToken()==null)throw new IOException("Drive authorization required");String token=auth.getAccessToken();
  String q="trashed=false and appProperties has { key='nasieHash' and value='"+job.getString("hash")+"' }";
  HttpURLConnection find=connection("https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q="+URLEncoder.encode(q,"UTF-8"));find.setRequestProperty("Authorization","Bearer "+token);
  if(new JSONObject(response(find)).getJSONArray("files").length()>0)return;
  String boundary="Nasie"+UUID.randomUUID();HttpURLConnection c=connection("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name");c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Content-Type","multipart/related; boundary="+boundary);
  byte[] body=multipart(boundary,job,true,null);c.setFixedLengthStreamingMode(body.length);try(OutputStream out=c.getOutputStream()){out.write(body);}if(new JSONObject(response(c)).optString("id").isEmpty())throw new IOException("Drive rejected backup");
 }
}
