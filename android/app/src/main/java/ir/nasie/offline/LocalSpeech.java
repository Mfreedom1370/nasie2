package ir.nasie.offline;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.SpeechService;
import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Private model and audio stay on the device; callbacks run on the main thread. */
final class LocalSpeech {
 interface Events { void ready(); void text(String text, boolean complete); void error(); }
 private final Context context;
 private final Handler main = new Handler(Looper.getMainLooper());
 private final ExecutorService loader = Executors.newSingleThreadExecutor();
 private Model model;
 private SpeechService service;
 private Recognizer recognizer;
 private int generation;
 private boolean destroyed;
 LocalSpeech(Context context){this.context=context.getApplicationContext();}
 private void copy(String source, File target) throws Exception {
  String[] children=context.getAssets().list(source);
  if(children!=null&&children.length>0){if(!target.isDirectory()&&!target.mkdirs())throw new Exception("model storage");for(String child:children)copy(source+"/"+child,new File(target,child));}
  else {try(InputStream in=context.getAssets().open(source);FileOutputStream out=new FileOutputStream(target)){byte[] bytes=new byte[8192];int count;while((count=in.read(bytes))!=-1)out.write(bytes,0,count);out.getFD().sync();}}
 }
 private Model load() throws Exception {
  if(model!=null)return model;
  File dir=new File(context.getFilesDir(),"voice-fa-042");
  String expected;
  try(InputStream in=context.getAssets().open("model-fa/version");java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream()){byte[] buffer=new byte[256];int count;while((count=in.read(buffer))!=-1)bytes.write(buffer,0,count);expected=bytes.toString("UTF-8");}
  File marker=new File(dir,"version");
  if(!marker.exists()||!new String(java.nio.file.Files.readAllBytes(marker.toPath()),StandardCharsets.UTF_8).equals(expected)){
   // The completion marker is copied last; interrupted copies are safely resumed.
   if(!dir.isDirectory()&&!dir.mkdirs())throw new Exception("model storage");
   String[] children=context.getAssets().list("model-fa");
   if(children!=null)for(String child:children)if(!child.equals("version"))copy("model-fa/"+child,new File(dir,child));
   copy("model-fa/version",marker);
  }
  model=new Model(dir.getAbsolutePath());return model;
 }
 void warm(Runnable ready,Runnable failed){loader.execute(()->{try{load();main.post(()->{if(!destroyed)ready.run();});}catch(Exception | LinkageError e){main.post(()->{if(!destroyed)failed.run();});}});}
 // The worker owns the recorder and recognizer. Invalidate posted callbacks on
 // the UI thread immediately, then join Vosk's recording thread before closing it.
 void start(Events events) {
  cancel();
  final int token = generation;
  loader.execute(() -> {
   try {
    recognizer = new Recognizer(load(), 16000);
    service = new SpeechService(recognizer, 16000);
    if (!service.startListening(new org.vosk.android.RecognitionListener() {
     private String segment = "";
     private boolean finishing;

     private boolean current() { return !destroyed && token == generation; }

     public void onPartialResult(String json) {
      if (!current() || finishing) return;
      try {
       String text = new JSONObject(json).optString("partial").trim();
       if (!text.isEmpty()) events.text(text, false);
      } catch (org.json.JSONException e) { events.error(); }
     }

     public void onResult(String json) {
      if (!current() || finishing) return;
      try {
       segment = new JSONObject(json).optString("text").trim();
       if (!segment.isEmpty()) { finishing = true; stop(); }
      } catch (org.json.JSONException e) { events.error(); }
     }

     public void onFinalResult(String json) {
      if (!current()) return;
      try {
       String tail = new JSONObject(json).optString("text").trim();
       events.text((segment + " " + tail).trim(), true);
      } catch (org.json.JSONException e) { events.error(); }
     }

     public void onError(Exception e) { if (current()) events.error(); }
     public void onTimeout() { if (current()) events.text(segment, true); }
    }, 30000)) throw new IllegalStateException("Recorder already running");
    main.post(() -> { if (!destroyed && token == generation) events.ready(); });
   } catch (Exception | LinkageError e) {
    releaseRecording();
    main.post(() -> { if (!destroyed && token == generation) events.error(); });
   }
  });
 }

 void stop() {
  if (!destroyed) loader.execute(() -> { if (service != null) service.stop(); });
 }

 void cancel() {
  generation++;
  if (!destroyed) loader.execute(this::releaseRecording);
 }

 private void releaseRecording() {
  if (service != null) {
   service.cancel();
   service.shutdown();
   service = null;
  }
  if (recognizer != null) {
   recognizer.close();
   recognizer = null;
  }
 }

 void destroy() {
  if (destroyed) return;
  destroyed = true;
  generation++;
  loader.execute(() -> {
   releaseRecording();
   if (model != null) { model.close(); model = null; }
  });
  loader.shutdown();
 }
}
