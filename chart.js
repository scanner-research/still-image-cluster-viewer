const VIDEO_PATH_PREFIX = '/videos/'
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
  jQuery.getJSON(VIDEO_PATH_PREFIX + `${person_name}.json`, function(videos) {
    jQuery.getJSON(FACE_PATH_PREFIX + `${person_name}.json`,
      function(faces) {
        callback(joinFacesWithVideos(videos, faces));
      }
    );
  });
}


const ARCHIVE_ENDPOINT ='https://ia801301.us.archive.org/0/items';


function mapFaceToJQueryElements(face) {
  let t0 = Math.max(face.t - 89, 0);
  let t1 = t0 + 179;
  let play_time = face.t - t0;
  let resetPlayTime = function() { $(this)[0].currentTime = play_time; };
  return $('<div>').addClass('vblock').append(
    $('<span>').text(`face id: ${face.id}`),
    $('<video controls>').prop({
      src: `${ARCHIVE_ENDPOINT}/${face.video.name}/${face.video.name}.mp4?start=${t0}&end=${t1}&exact=1&ignore=x.mp4`,
    }).attr(
      {width: 240, height: 160}
    ).on('loadeddata', resetPlayTime).on('pause', resetPlayTime)
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
  return a[1].length - b[1].length;
}


function computeProportions(faces, n_clusters, k_samples_per_cluster) {
 	//Goal: to get proportion of clusters per slice
	slice_section = 'channel'; //CHANGE FROM STATIC
	let channels = ['CNN', 'MSNBC', 'FOXNEWS'];
	if (slice_section == 'channel') {
		let cluster_tracker = {'CNN':{}, 'FOXNEWS':{}, 'MSNBC':{}};
		for (face in faces) {
			let curr_channel = faces[face].video.channel;
			var curr_cluster = faces[face].cluster_id;
			if (curr_cluster in cluster_tracker[curr_channel]) {
				cluster_tracker[curr_channel][curr_cluster]+=1;
			} else {
				cluster_tracker[curr_channel][curr_cluster]=1;
			}
			if ('minutes' in cluster_tracker[curr_channel]) {
				cluster_tracker[curr_channel]['minutes'] += 3;
			} else {
				cluster_tracker[curr_channel]['minutes'] = 3;
			}
		}
		console.log(cluster_tracker);
	}
	
}

function mapSliceToJQueryElements(faces, n_clusters, k_samples_per_cluster) {
  computeProportions(faces, n_clusters, k_samples_per_cluster);
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
      return $('<div>').addClass('cluster-div').append(
        $('<h3>').text(`cluster ${cluster_id} - ${cluster_faces.length * 3}s`),
        $('<div>').append(...sampled_faces.map(mapFaceToJQueryElements))
      );
    }
  );
}


// TODO: make this an argument that can be set by a html input
const N_SLICES_TO_SHOW = 10;
const N_CLUSTERS_TO_SHOW = 3;
const N_VIDEOS_PER_CLUSTER = 5;


function render(div_id, faces, slice_by) {
  $(div_id).empty();
  console.log('Slicing by:', slice_by ? slice_by : 'none');

  // Do the slicing (split into groups by slice_by)
  let slices = {'all': faces};

  // Might want to drop some groups
  // - sort by total time
  // - count total amount of time (normalization constants) before dropping

  // Use jquery to write html with videos

  $(div_id).append(
    // Convert slices to JQuery objects for HTML
    ...Object.entries(slices).sort(
      sortEntriesByValueListLen
    ).slice(0, N_SLICES_TO_SHOW).map(
      ([slice_name, slice_faces]) => {
        return $('<div>').addClass('slice-div').append(
          $('<h2>').addClass('title').text(slice_name),
          mapSliceToJQueryElements(faces, N_CLUSTERS_TO_SHOW, N_VIDEOS_PER_CLUSTER)
        );
      }
    )
  );
}
