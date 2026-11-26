package ir.nasie.offline;
import android.content.Context;
import androidx.work.*;
public final class BackupClock extends Worker {
 public BackupClock(Context c,WorkerParameters p){super(c,p);}
 @Override public Result doWork(){try{Context c=getApplicationContext();BackupEngine.record(c,BackupEngine.ledger(c).toString());return Result.success();}catch(Exception e){BackupEngine.status(getApplicationContext(),"آماده‌سازی بکاپ به تعویق افتاد");return Result.retry();}}
}
