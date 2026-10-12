package ir.nasie.offline;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Base64;
import android.util.AtomicFile;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public final class MainActivity extends Activity {
 private static final int PICK_FILE=40, SAVE_FILE=41, MIC_PERMISSION=42;
 private static final String HOME="https://appassets.androidplatform.net/assets/www/index.html";
 private WebView web;
 private AtomicFile ledgerFile;
 private JSONObject storageState;
 private ValueCallback<Uri[]> fileCallback;
 private byte[] exportBytes;
 private boolean exporting=false;
 private SpeechRecognizer speech;
 private int speechId=0;
 private volatile boolean storageFailed=false;
 private boolean microphonePermissionPending=false;

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  ledgerFile=new AtomicFile(new File(getFilesDir(),"ledger-state.json"));
  try{
   File base=ledgerFile.getBaseFile();
   storageState=base.exists()||new File(base.getPath()+".bak").exists()
    ?new JSONObject(new String(ledgerFile.readFully(),StandardCharsets.UTF_8)):new JSONObject();
   java.util.Iterator<String> keys=storageState.keys();
   while(keys.hasNext()){String key=keys.next();if(!validKey(key)||!(storageState.get(key) instanceof String))throw new IllegalStateException("Invalid ledger container");}
  }catch(Exception e){storageFailed=true;storageState=new JSONObject();}
  web=new WebView(this);
  FrameLayout frame=new FrameLayout(this);frame.addView(web);setContentView(frame);
  frame.setOnApplyWindowInsetsListener((view,insets)->{
   view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),
    insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
   return insets.consumeSystemWindowInsets();
  });
  WebSettings settings=web.getSettings();
  settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
  settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
  settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setSupportMultipleWindows(false);
  WebView.setWebContentsDebuggingEnabled(false);
  WebViewAssetLoader loader=new WebViewAssetLoader.Builder()
   .addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    if("appassets.androidplatform.net".equals(request.getUrl().getHost())) {
     WebResourceResponse result=loader.shouldInterceptRequest(request.getUrl());
     return result!=null?result:new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,null);
    }
    return super.shouldInterceptRequest(view,request);
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    // No external page may execute with the ledger bridge attached, including subframes.
    Uri u=request.getUrl();
    if(HOME.equals(u.toString()))return false;
    if(request.isForMainFrame()&&("https".equals(u.getScheme())||"tel".equals(u.getScheme()))) {
     try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
    }
    return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);
    fileCallback=callback;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
    intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});
    try{startActivityForResult(intent,PICK_FILE);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}
    return true;
   }
  });
  web.addJavascriptInterface(new NativeBridge(),"NasieNative");
  web.loadUrl(HOME);
 }
 private String reply(boolean ok,Object value){
  try{return new JSONObject().put("ok",ok).put(ok?"value":"error",value==null?JSONObject.NULL:value).toString();}
  catch(Exception e){return "{\"ok\":false,\"error\":\"Storage unavailable\"}";}
 }
 private boolean validKey(String key){return key!=null&&key.matches("nasie(?:_[a-zA-Z0-9_]+)?");}
 private boolean commitState(JSONObject next){
  FileOutputStream out=null;
  try{
   byte[] bytes=next.toString().getBytes(StandardCharsets.UTF_8);
   out=ledgerFile.startWrite();out.write(bytes);out.getFD().sync();ledgerFile.finishWrite(out);out=null;
   if(!java.util.Arrays.equals(bytes,ledgerFile.readFully()))throw new IllegalStateException("Write verification failed");
   storageState=next;return true;
  }catch(Exception e){if(out!=null)ledgerFile.failWrite(out);storageFailed=true;return false;}
 }
 public final class NativeBridge {
  @JavascriptInterface public synchronized String get(String key){
   if(storageFailed)return reply(false,"ذخیره‌سازی ناموفق بود؛ برنامه را کامل ببند و دوباره باز کن");
   if(!validKey(key))return reply(false,"Invalid storage key");
   try{return reply(true,storageState.has(key)?storageState.getString(key):null);}catch(Exception e){return reply(false,"Storage read failed");}
  }
  @JavascriptInterface public synchronized String put(String key,String value){
   if(storageFailed)return reply(false,"Storage write stopped");
   if(!validKey(key))return reply(false,"Invalid storage key");
   try{return reply(commitState(new JSONObject(storageState.toString()).put(key,value)),null);}catch(Exception e){storageFailed=true;return reply(false,"Storage write failed");}
  }
  @JavascriptInterface public synchronized String remove(String key){
   if(storageFailed)return reply(false,"Storage write stopped");
   if(!validKey(key))return reply(false,"Invalid storage key");
   try{JSONObject next=new JSONObject(storageState.toString());next.remove(key);return reply(commitState(next),null);}catch(Exception e){storageFailed=true;return reply(false,"Storage write failed");}
  }
  @JavascriptInterface public String exportFile(String data,String name,String mime){
   synchronized(MainActivity.this){
    if(exporting)return reply(false,"یک ذخیرهٔ فایل در حال انجام است؛ ابتدا آن را تمام کن");
    try{exportBytes=Base64.decode(data,Base64.DEFAULT);}catch(Exception e){return reply(false,"Invalid export");}
    exporting=true;
   }
   runOnUiThread(()->{
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
     .setType(mime).putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^a-zA-Z0-9._-]","_"));
    try{startActivityForResult(intent,SAVE_FILE);}catch(Exception e){completeExport(false);}
   });
   return reply(true,null);
  }
  @JavascriptInterface public void startSpeech(int id){runOnUiThread(()->beginSpeech(id));}
  @JavascriptInterface public void stopSpeech(int id,boolean abort){runOnUiThread(()->{
   if(id!=speechId)return;
   if(abort)endSpeech("aborted");else if(speech!=null)speech.stopListening();else endSpeech("aborted");
  });}
 }
 private void emitSpeech(int id,String type,Object payload){
  web.evaluateJavascript("window.NasieAndroid&&window.NasieAndroid.speech("+id+","+JSONObject.quote(type)+","+
   (payload==null?"null":payload instanceof String?JSONObject.quote((String)payload):payload.toString())+");",null);
 }
 private void beginSpeech(int id){
  if(speechId!=0)endSpeech("aborted");speechId=id;
  if(Build.VERSION.SDK_INT<31||!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){endSpeech("offline-unavailable");return;}
  if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
   microphonePermissionPending=true;
   requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},MIC_PERMISSION);return;
  }
  try{
   speech=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
   speech.setRecognitionListener(new RecognitionListener(){
    public void onReadyForSpeech(Bundle b){emitSpeech(id,"start",null);}
    public void onBeginningOfSpeech(){}
    public void onRmsChanged(float rms){}
    public void onBufferReceived(byte[] buffer){}
    public void onEndOfSpeech(){}
    public void onPartialResults(Bundle b){}
    public void onEvent(int event,Bundle b){}
    public void onError(int error){
     if(speechId!=id)return;
     String code=error==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"not-allowed":
      error==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||error==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE?"language-not-supported":
      error==SpeechRecognizer.ERROR_NO_MATCH||error==SpeechRecognizer.ERROR_SPEECH_TIMEOUT?"no-speech":
      error==SpeechRecognizer.ERROR_AUDIO?"audio-capture":"offline-unavailable";
     endSpeech(code);
    }
    public void onResults(Bundle b){
     if(speechId!=id)return;
     ArrayList<String> texts=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
     float[] scores=b.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
     try{
      JSONArray confidence=new JSONArray();
      if(scores!=null)for(float score:scores)confidence.put(Float.isFinite(score)?Math.max(0,score):0);
      if(texts!=null&&!texts.isEmpty())emitSpeech(id,"result",new JSONObject().put("texts",new JSONArray(texts)).put("confidence",confidence));
     }catch(Exception ignored){}
     endSpeech(null);
    }
   });
   Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE,"fa-IR")
    .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,5).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
   speech.startListening(intent);
   web.postDelayed(()->{if(speechId==id)endSpeech("no-speech");},35000);
  }catch(Exception e){endSpeech("offline-unavailable");}
 }
 private void endSpeech(String error){
  int id=speechId;speechId=0;
  if(speech!=null){speech.cancel();speech.destroy();speech=null;}
  if(id==0)return;
  if(error!=null)emitSpeech(id,"error",error);emitSpeech(id,"end",null);
 }
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){
  super.onRequestPermissionsResult(request,permissions,grants);
  if(request==MIC_PERMISSION&&speechId!=0){
   microphonePermissionPending=false;
   int id=speechId;speechId=0;
   if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)beginSpeech(id);
   else{speechId=id;endSpeech("not-allowed");}
  }
 }
 private void completeExport(boolean success){
  synchronized(this){exporting=false;exportBytes=null;}
  runOnUiThread(()->web.evaluateJavascript("window.NasieAndroid&&window.NasieAndroid.saved("+success+");",null));
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK_FILE&&fileCallback!=null){
   fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;
  }
  if(request==SAVE_FILE){
   final byte[] bytes=exportBytes;
   if(result!=RESULT_OK||data==null||data.getData()==null||bytes==null){completeExport(false);return;}
   Uri destination=data.getData();
   new Thread(()->{
    boolean ok=false;
    try(OutputStream out=getContentResolver().openOutputStream(destination,"wt")){
     if(out!=null){out.write(bytes);out.flush();ok=true;}
    }catch(Exception ignored){}
    completeExport(ok);
   },"nasie-export").start();
  }
 }
 @Override protected void onPause(){
  if(!microphonePermissionPending)endSpeech("aborted");
  web.evaluateJavascript("if(typeof Store!=='undefined'&&Store.releaseWriter)Store.releaseWriter()",null);
  web.onPause();super.onPause();
 }
 @Override protected void onResume(){
  super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("if(typeof Store!=='undefined'&&Store.acquireWriter)Store.acquireWriter()",null);}
 }
 @Override protected void onDestroy(){endSpeech("aborted");if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("NasieNative");web.destroy();super.onDestroy();}
 @Override public void onBackPressed(){
  web.evaluateJavascript("(()=>{if(typeof dismiss==='function'&&!document.querySelector('#sheet').hidden){dismiss();return false}return true})()",result->{
   if("true".equals(result))new AlertDialog.Builder(this).setMessage("برنامه بسته شود؟")
    .setPositiveButton("بستن",(dialog,which)->finish()).setNegativeButton("ادامه",null).show();
  });
 }
}
