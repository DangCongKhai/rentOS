<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;">
    <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="background:#f4f7fb;"
    >
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    style="max-width:560px;background:#ffffff;border:1px solid #dce5ef;border-radius:16px;"
                >
                    <tr>
                        <td
                            style="background:#0e1a20;padding:20px 28px;border-radius:16px 16px 0 0;"
                        >
                            <span
                                style="color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:700;"
                            >rent<span style="color:#8fbcd0;">OS</span></span>
                        </td>
                    </tr>
                    <tr>
                        <td
                            style="padding:28px;font-family:Arial,sans-serif;color:#1c2633;"
                        >
                            <p
                                style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:700;"
                            >{{ $title }}</p>
                            <p
                                style="margin:0 0 24px;font-size:15px;line-height:24px;color:#3d4b5c;"
                            >{{ $body }}</p>
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td
                                        style="border-radius:10px;background:#3368a0;"
                                    >
                                        <a
                                            href="{{ $link }}"
                                            style="display:inline-block;padding:12px 20px;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;"
                                        >Mở trên rentOS</a>
                                    </td>
                                </tr>
                            </table>
                            <p
                                style="margin:16px 0 0;font-size:12px;line-height:18px;color:#617087;word-break:break-all;"
                            >{{ $link }}</p>
                        </td>
                    </tr>
                    <tr>
                        <td
                            style="padding:16px 28px 24px;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#617087;"
                        >
                            Email này được gửi vì có việc mới trên tài khoản
                            rentOS của bạn.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
