const fixAndroidUri = (uri) => {
    // Fix Android URI format if necessary
    if (uri.startsWith('file:/')) {
        return `file:///${uri.split('file:/').join('')}`;
    }
    return uri;

};

console.log(fixAndroidUri('file:///data/user/0/com.techbrains.society/cache/ImagePicker/38565588-59b3-47a7-9db4-1779c35c4d4d.jpeg'))


