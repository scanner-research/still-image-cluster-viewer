const VIDEO_PATH = '/videos.json'
const FACE_PATH_PREFIX = '/faces/'

/* In case we ever want it
 * function timeToMinutes (time) {
	//convert time to mintues: hhmmss
	var total_min = 0;
	for (var i = 0; i < time.length; i+=2) {
		let time_elt = time.slice(i, i+2);
		if (i == 0) total_min+=parseInt(time_elt)/60
		else if (i == 2) total_min+=parseInt(time_elt)
		else total_min+=parseInt(time_elt)*60
	}
	return total_min;
}*/

function parseVideoName(video_name, width, height) {
  // Splits a video name into parts
  let tokens = video_name.split('_');
  var channel = tokens[0];
  if (channel.endsWith('W')) {
    channel = channel.substring(0, channel.length - 1);
  }
  var date = tokens[1];
  var time = tokens[2];
  var show = '';
  if (tokens.length > 3) {
    show = tokens.slice(3).join('_');
  }
  return {
    name: video_name,
    channel: channel,
    show: show,
    date: date, // YYYYMMDD
    time: time, // hhmmss
    width: width,
    height: height
  };
}

function joinFacesWithVideos(videos, faces) {
  let video_dict = {};
  videos.forEach(v => {
    video_dict[v[0]] = parseVideoName(...v.slice(1)); // id and name respectively
  });
  return faces.map(face => {
    return {
      id: face.face_id, t: face.t, cluster_id: face.cluster_id,
      video: video_dict[face.video_id]
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


function mapKVToJQueryElements(key, value) {
  return $('<span>').addClass('kv-span').append(
    $('<span>').addClass('key').text(key),
    $('<span>').addClass('value').text(value));
}


const ARCHIVE_ENDPOINT = 'https://ia801301.us.archive.org/0/items';

function mapFaceToJQueryElements(face) {
  let t0 = Math.max(face.t - 89, 0);
  let t1 = t0 + 179;
  let play_time = face.t - t0;
  let resetPlayTime = function() { $(this)[0].currentTime = play_time; };
  return $('<div>').addClass('vblock').append(
    $('<video controls>').prop({
      src: `${ARCHIVE_ENDPOINT}/${face.video.name}/${face.video.name}.mp4?start=${t0}&end=${t1}&exact=1&ignore=x.mp4`,
    }).attr(
      {width: 240, height: 160}
    ).on('loadeddata', resetPlayTime).on('pause', resetPlayTime),
    $('<div>').append(
      mapKVToJQueryElements('Face id', face.id),
      mapKVToJQueryElements('Channel', face.video.channel),
      mapKVToJQueryElements('Show', face.video.show),
      mapKVToJQueryElements('Date', face.video.date),
    ),
  );
  // FIXME: archive player is imprecise with previews, so we have to use
  // unofficial API
  // return $('<iframe>').prop({
  //   src: `https://archive.org/embed/${face.video.name}?start=${t0}&end=${t1}&exact=1`,
  //   width: 240, height: 160, frameborder: 0,
  //   webkitallowfullscreen: true, mozallowfullscreen: true
  // });
}


/* Sorts a list of [k, value list] by desending value list length */
function sortEntriesByValueListLen(a, b) {
  return b[1].length -  a[1].length;
}


// function computeProportions(faces, n_clusters, k_samples_per_cluster) {
//  	//Goal: to get proportion of clusters per slice
// 	slice_section = 'channel'; //CHANGE FROM STATIC
// 	let channels = ['CNN', 'MSNBC', 'FOXNEWS'];
// 	if (slice_section == 'channel') {
// 		let cluster_tracker = {'CNN':{}, 'FOXNEWS':{}, 'MSNBC':{}};
// 		for (face in faces) {
// 			let curr_channel = faces[face].video.channel;
// 			var curr_cluster = faces[face].cluster_id;
// 			if (curr_cluster in cluster_tracker[curr_channel]) {
// 				cluster_tracker[curr_channel][curr_cluster]+=1;
// 			} else {
// 				cluster_tracker[curr_channel][curr_cluster]=1;
// 			}
// 			if ('minutes' in cluster_tracker[curr_channel]) {
// 				cluster_tracker[curr_channel]['minutes'] += 3;
// 			} else {
// 				cluster_tracker[curr_channel]['minutes'] = 3;
// 			}
// 		}
// 		console.log(cluster_tracker);
// 	}
//
// }


function facesToSeconds(faces) {
  return faces.length * 3;
}


function mapSliceToJQueryElements(
  faces, n_clusters, k_samples_per_cluster, n_faces_in_all_slices, slice_by
) {
  let n_faces_in_slice = faces.length;
  let faces_by_cluster = {};
  faces.forEach(f => {
    let cluster_id = f.cluster_id;
    if (!faces_by_cluster.hasOwnProperty(cluster_id)) {
      faces_by_cluster[cluster_id] = [f];
    } else {
      faces_by_cluster[cluster_id].push(f);
    }
  });

  let faces_by_cluster_arr = Object.entries(
    faces_by_cluster
  ).sort(sortEntriesByValueListLen);

  return faces_by_cluster_arr.slice(0, n_clusters).map(
    ([cluster_id, cluster_faces]) => {
      let sampled_faces = _.sampleSize(cluster_faces, k_samples_per_cluster);
      let cluster_seconds = facesToSeconds(cluster_faces);
      return $('<div>').addClass('cluster-div').append(
        $('<h3>').text(`cluster ${cluster_id}`),
        $('<div>').append(
          mapKVToJQueryElements(
            'Screen time',
            `${cluster_seconds.toLocaleString(undefined, {maximumFractionDigits: 2})} m`
          ),
          mapKVToJQueryElements(
            `Percent of ${slice_by}`,
            `${(cluster_faces.length / n_faces_in_slice * 100).toLocaleString(undefined, {maximumFractionDigits: 2})} %`
          ),
          mapKVToJQueryElements(
            'Percent of total',
            `${(cluster_faces.length / n_faces_in_all_slices * 100).toLocaleString(undefined, {maximumFractionDigits: 2})} %`
          )
        ),
        $('<div>').addClass('video-div').append(...sampled_faces.map(mapFaceToJQueryElements))
      );
    }
  );
}


// TODO: make this an argument that can be set by a html input
const N_SLICES_TO_SHOW = 5;
const N_CLUSTERS_TO_SHOW = 5;
const N_VIDEOS_PER_CLUSTER = 6;


function getSliceByReducer(video_property) {
  return (acc, face) => {
    let key = face.video[video_property];
    if (acc.hasOwnProperty(key)) {
      acc[key].push(face);
    } else {
      acc[key] = [face];
    }
    return acc;
  }
}


function render(div_id, faces, slice_by) {
  $(div_id).empty();

  // Do the slicing (split into groups by slice_by)
  var slices;
  if (slice_by == 'all') {
    slices = {'all': faces};
  } else if (slice_by == 'channel') {
    slices = faces.reduce(getSliceByReducer('channel'), {});
  } else if (slice_by == 'show') {
    slices = faces.reduce(getSliceByReducer('show'), {});
  }

  let n_faces_in_all_slices = faces.length;

  // Use jquery to write html with videos
  $(div_id).append(
    // Convert slices to JQuery objects for HTML
    ...Object.entries(slices).sort(
      sortEntriesByValueListLen
    ).slice(0, N_SLICES_TO_SHOW).map(
      ([slice_name, slice_faces]) => {
        let slice_seconds = facesToSeconds(slice_faces);
        return $('<div>').addClass('slice-div').append(
          $('<h2>').addClass('title').text(slice_name),
          $('<div>').append(
            mapKVToJQueryElements(
              'Screen time',
              `${slice_seconds.toLocaleString(undefined, {maximumFractionDigits: 2})} m`
            ),
            mapKVToJQueryElements(
              `Percent of total`,
              `${(slice_faces.length / n_faces_in_all_slices * 100).toLocaleString(undefined, {maximumFractionDigits: 2})} %`
            )
          ),
          mapSliceToJQueryElements(
            slice_faces, N_CLUSTERS_TO_SHOW, N_VIDEOS_PER_CLUSTER,
            n_faces_in_all_slices, slice_by)
        );
      }
    )
  );
}
