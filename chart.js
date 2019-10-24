const VIDEO_PATH = '/videos.json'
const FACE_PATH_PREFIX = '/faces/'

function parseVideoName(video_name) {
  // Splits a video name into parts
  let tokens = video_name.split('_', 3);
  var channel = tokens[0];
  if (channel.endsWith('W')) {
    channel = channel.substring(0, channel.length - 2);
  }
  var date = tokens[1];
  var time = tokens[2];
  var show = '';
  if (tokens.length > 3) {
    show = tokens[3];
  }
  return {
    name: video_name,
    channel: channel,
    show: show,
    date: date, // YYYYMMDD
    time: time  // hhmmss
  };
}

function joinFacesWithVideos(videos, faces) {
  let video_dict = {};
  videos.forEach(v => {
    video_dict[v.id] = parseVideoName(v.name);
  });
  return faces.map(face => {
    return {
      id: face.id, t: face.t, cluster_id: face.cluster_id,
      video: videos[face.video_id]
    };
  });
}

function init(person_name, callback) {
  jQuery.getJSON(VIDEO_PATH, function(videos) {
    jQuery.getJSON(FACE_PATH_PREFIX + `${person_name}.json`,
      function(faces) {
        callback(joinFacesWithVideos(videos, faces));
      }
    );
  });
}

function render(div_id, faces, slice_by) {
  $(div_id).empty();
  console.log('Slicing by:', slice_by);

  // Do the slicing (split into groups by slice_by)

  // Might want to drop some groups
  // - sort by total time
  // - count total amount of time (normalization constants) before dropping

  // Use jquery to write html with videos

  $(div_id).append(
    // TODO: we gotta make our html here
  );
}
