$(function () {

    var channel = getParameterByName('channel')
    if (!channel) {
        channel = 'Trivia';
        window.history.pushState(null, "Chat Log", "/chat?channel=Trivia");
    }
    var socket = io.connect('http://dotatrivia.com/?channel=' + channel);
    var last_count = null;
    var lPad = function(s){ while(s.length<2){s="0"+s;}return s;}

    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    socket.on('notification', function(docs) {
        //console.log(docs);
        if (last_count == null) {
            last_count = new Date('1970-01-01');
            //$('table tbody tr').remove();
        }
        
        docs.d.forEach(function (d) {
            var c = new Date(d.createdAt)
            if (last_count.valueOf() < c.valueOf()) {
                var $tr = $('<tr>');
                var c_str = lPad(c.getHours().toString()) + ':' + lPad(c.getMinutes().toString()) + ':' + lPad(c.getSeconds().toString());
                $tr.append($('<td class="text-right">' + c_str + '</td>'));
                $tr.append($('<td class="text-right bold">' + d.personaName + '</td>'));
                $tr.append($('<td class="text-left">' + d.message + '</td>'));
                $('table tbody').append($tr);
            }
        });
        
        $('#viewer-count').text(docs.n + ' viewing this page.');
        last_count = new Date(docs.c);
    });
    
    $('#btn-clear').click(function () {
        $('table tbody tr').remove();
    });
});