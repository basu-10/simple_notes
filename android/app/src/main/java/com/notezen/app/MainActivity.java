package com.notezen.app;

import com.getcapacitor.BridgeActivity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    private static final String JS_INTERFACE = "NoteZenShare";
    // Holds the most recent shared payload (JSON) until the web app reads it.
    private String pendingShare = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            wv.addJavascriptInterface(new ShareJsBridge(), JS_INTERFACE);
        }
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
        // App is already running and the web view is live: nudge the JS side.
        if (pendingShare != null) dispatchToJs();
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            String type = intent.getType();
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text == null && intent.hasExtra(Intent.EXTRA_STREAM)) {
                Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                text = stream != null ? stream.toString() : "";
            }
            setPending(text, intent.getStringExtra(Intent.EXTRA_SUBJECT), type);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<CharSequence> texts = intent.getCharSequenceArrayListExtra(Intent.EXTRA_TEXT);
            StringBuilder sb = new StringBuilder();
            if (texts != null) {
                for (CharSequence t : texts) {
                    if (sb.length() > 0) sb.append("\n\n");
                    sb.append(t);
                }
            }
            if (sb.length() == 0 && intent.hasExtra(Intent.EXTRA_STREAM)) {
                ArrayList<?> streams = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (streams != null) {
                    for (Object s : streams) {
                        if (sb.length() > 0) sb.append("\n");
                        sb.append(s != null ? s.toString() : "");
                    }
                }
            }
            setPending(sb.toString(), intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getType());
        }
    }

    private void setPending(String text, String subject, String type) {
        try {
            JSONObject o = new JSONObject();
            o.put("text", text == null ? "" : text);
            o.put("subject", subject == null ? "" : subject);
            o.put("type", type == null ? "" : type);
            pendingShare = o.toString();
        } catch (Exception e) {
            pendingShare = null;
        }
    }

    private void dispatchToJs() {
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        wv.post(() -> wv.evaluateJavascript(
            "window.dispatchEvent(new Event('notezen:shareready'));", null));
    }

    // Exposed to JavaScript as window.NoteZenShare
    public class ShareJsBridge {
        @JavascriptInterface
        public String getPending() {
            String p = pendingShare;
            pendingShare = null; // consume once
            return p == null ? "" : p;
        }

        @JavascriptInterface
        public void clear() {
            pendingShare = null;
        }
    }
}
