package ir.nasie.offline;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.AtomicFile;
import android.util.Base64;
import android.view.TextureView;
import android.widget.FrameLayout;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.UUID;
import javax.net.SocketFactory;

@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
final class CounterCamera {
 interface Result { void done(String id,String error); }
 private final Context context;
 private final FrameLayout frame;
 private final SharedPreferences prefs;
 private final Handler ui=new Handler(Looper.getMainLooper());
 private ExoPlayer player;
 private TextureView surface;
 private Result pending;
 private final Runnable timeout=()->finish(null,"تصویر دوربین دریافت نشد. آی‌پی، رمز محلی و پخش H.264 را بررسی کنید.");

 CounterCamera(Context context,FrameLayout frame){
  this.context=context;this.frame=frame;
  prefs=context.getSharedPreferences("counter-camera",Context.MODE_PRIVATE);
 }
 static boolean privateAddress(String ip){
  if(ip==null||!ip.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}"))return false;
  String[] parts=ip.split("\\.");
  int[] n=new int[4];
  for(int i=0;i<4;i++){
   n[i]=Integer.parseInt(parts[i]);
   if(n[i]>255||!String.valueOf(n[i]).equals(parts[i]))return false;
  }
  return n[0]==10||(n[0]==192&&n[1]==168)||(n[0]==172&&n[1]>=16&&n[1]<=31);
 }
 JSONObject settings() throws Exception {
  return new JSONObject().put("host",prefs.getString("host","")).put("user",prefs.getString("user","admin"))
   .put("port",prefs.getInt("port",554)).put("stream",prefs.getInt("stream",0))
   .put("configured",prefs.contains("password"));
 }
 void configure(String host,String user,String password,int port,int stream)throws IOException{
  if(!privateAddress(host)||!user.matches("[A-Za-z0-9_.-]{1,64}")||port<1||port>65535||stream<0||stream>1)
   throw new IOException("نشانی محلی، نام کاربری یا تنظیمات جریان معتبر نیست.");
  if(password.isEmpty()&&host.equals(prefs.getString("host",""))&&user.equals(prefs.getString("user",""))&&port==prefs.getInt("port",554))
   password=prefs.getString("password","");
  if(password.isEmpty()||password.length()>128||password.indexOf('\n')>=0||password.indexOf('\r')>=0)
   throw new IOException("رمز محلی دوربین لازم است.");
  if(!prefs.edit().putString("host",host).putString("user",user).putString("password",password).putInt("port",port).putInt("stream",stream).commit())
   throw new IOException("تنظیمات ذخیره نشد.");
 }
 void capture(Result result){
  if(pending!=null){result.done(null,"در حال گرفتن عکس قبلی هستیم.");return;}
  String host=prefs.getString("host",""),user=prefs.getString("user",""),password=prefs.getString("password","");
  int port=prefs.getInt("port",554),stream=prefs.getInt("stream",0);
  if(!privateAddress(host)||password.isEmpty()){result.done(null,"ابتدا دوربین پیشخوان را در تنظیمات وصل کنید.");return;}
  SocketFactory network=wifiSocketFactory();
  if(network==null){result.done(null,"گوشی را به وای‌فای دوربین وصل کنید.");return;}
  pending=result;
  try{
   surface=new TextureView(context);
   frame.addView(surface,0,new FrameLayout.LayoutParams(640,360));
   Uri uri=Uri.parse("rtsp://"+Uri.encode(user)+":"+Uri.encode(password)+"@"+host+":"+port+"/cam/realmonitor?channel=1&subtype="+stream);
   player=new ExoPlayer.Builder(context).build();
   ExoPlayer active=player;
   player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_AUDIO,true).build());
   player.setVideoTextureView(surface);
   player.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){ui.postDelayed(()->{if(player==active)saveFrame();},220);}
    @Override public void onPlayerError(PlaybackException e){
     if(player==active)finish(null,"ارتباط با دوربین برقرار نشد. آدرس، رمز و جریان H.264 را بررسی کنید.");
    }
   });
   player.setMediaSource(new RtspMediaSource.Factory().setSocketFactory(new CameraSockets(network,host,port))
    .setForceUseRtpTcp(true).setTimeoutMs(7000).createMediaSource(MediaItem.fromUri(uri)));
   ui.postDelayed(timeout,10000);
   player.prepare();player.play();
  }catch(Exception e){finish(null,"راه‌اندازی تصویر دوربین ممکن نشد.");}
 }
 private SocketFactory wifiSocketFactory(){
  ConnectivityManager manager=context.getSystemService(ConnectivityManager.class);
  if(manager!=null)for(Network network:manager.getAllNetworks()){
   NetworkCapabilities capabilities=manager.getNetworkCapabilities(network);
   if(capabilities!=null&&capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return network.getSocketFactory();
  }
  return null;
 }
 private void saveFrame(){
  Bitmap bitmap=null;
  try{
   if(surface==null||!surface.isAvailable())throw new IOException();
   bitmap=surface.getBitmap(1280,720);
   if(bitmap==null)throw new IOException();
   String id=UUID.randomUUID().toString();
   AtomicFile file=new AtomicFile(photoFile(id));
   FileOutputStream out=file.startWrite();
   try{
    if(!bitmap.compress(Bitmap.CompressFormat.JPEG,86,out))throw new IOException();
    file.finishWrite(out);
   }catch(Exception e){file.failWrite(out);throw e;}
   finish(id,null);
  }catch(Exception e){finish(null,"ذخیره عکس دوربین ممکن نشد.");}
  finally{if(bitmap!=null)bitmap.recycle();}
 }
 String photo(String id,boolean temporary)throws IOException{
  AtomicFile file=new AtomicFile(photoFile(id));
  byte[] bytes=file.readFully();
  if(temporary)file.delete();
  return "data:image/jpeg;base64,"+Base64.encodeToString(bytes,Base64.NO_WRAP);
 }
 private File photoFile(String id)throws IOException{
  if(id==null||!id.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw new IOException();
  File dir=new File(context.getFilesDir(),"counter-photos");
  if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException();
  return new File(dir,id+".jpg");
 }
 void cancel(){if(pending!=null)finish(null,"گرفتن عکس متوقف شد.");}
 private void finish(String id,String error){
  Result result=pending;pending=null;
  ui.removeCallbacks(timeout);
  if(player!=null){ExoPlayer old=player;player=null;old.release();}
  if(surface!=null){frame.removeView(surface);surface=null;}
  if(result!=null)result.done(id,error);
 }
 private static final class CameraSockets extends SocketFactory {
  private final SocketFactory wifi;
  private final String host;
  private final int port;
  CameraSockets(SocketFactory wifi,String host,int port){this.wifi=wifi;this.host=host;this.port=port;}
  @Override public Socket createSocket(String target,int targetPort)throws IOException{
   if(!host.equals(target)||port!=targetPort)throw new IOException("Redirect not allowed");
   Socket socket=wifi.createSocket();
   try{socket.connect(new InetSocketAddress(host,port),4000);return socket;}
   catch(IOException error){socket.close();throw error;}
  }
  @Override public Socket createSocket(InetAddress ip,int p)throws IOException{return createSocket(ip.getHostAddress(),p);}
  @Override public Socket createSocket(String h,int p,InetAddress local,int localPort)throws IOException{throw new IOException();}
  @Override public Socket createSocket(InetAddress h,int p,InetAddress local,int localPort)throws IOException{throw new IOException();}
 }
}
